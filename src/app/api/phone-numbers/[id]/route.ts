import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { safeParseJson, isValidUuid } from '@/lib/validation';
import { decrypt } from '@/lib/crypto';

interface RouteParams {
    params: Promise<{ id: string }>;
}

const PROVIDER_API_TIMEOUT = 15_000;

// GET /api/phone-numbers/[id] - Get a phone number
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = await createClient();

        const { data: phoneNumber, error } = await supabase
            .from('phone_numbers')
            .select('*, agent:agents(id, name)')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (error || !phoneNumber) {
            return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
        }

        return NextResponse.json({ data: phoneNumber });
    } catch (error) {
        console.error('Error fetching phone number:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/phone-numbers/[id] - Update phone number (assign to agent, nickname)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const body = bodyOrError;
        const supabase = await createClient();

        // Verify ownership
        const { data: existing } = await supabase
            .from('phone_numbers')
            .select('id, external_id, provider')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        // Helper to validate agent belongs to this agency
        const validateAgentOwnership = async (agentId: string): Promise<boolean> => {
            if (!agentId) return true; // null/undefined is valid (unassign)
            const { data: agent } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agentId)
                .eq('agency_id', user.agency.id)
                .single();
            return !!agent;
        };

        if (body.nickname !== undefined) updateData.nickname = body.nickname;
        // Support both old agent_id and new inbound/outbound agent IDs
        // Validate agent ownership before allowing assignment
        if (body.agent_id !== undefined) {
            if (body.agent_id && !(await validateAgentOwnership(body.agent_id))) {
                return NextResponse.json({ error: 'Agent not found in your agency' }, { status: 400 });
            }
            updateData.agent_id = body.agent_id || null;
            updateData.inbound_agent_id = body.agent_id || null;
        }
        if (body.inbound_agent_id !== undefined) {
            if (body.inbound_agent_id && !(await validateAgentOwnership(body.inbound_agent_id))) {
                return NextResponse.json({ error: 'Inbound agent not found in your agency' }, { status: 400 });
            }
            updateData.inbound_agent_id = body.inbound_agent_id || null;
            updateData.agent_id = body.inbound_agent_id || null; // Keep backwards compat
        }
        if (body.outbound_agent_id !== undefined) {
            if (body.outbound_agent_id && !(await validateAgentOwnership(body.outbound_agent_id))) {
                return NextResponse.json({ error: 'Outbound agent not found in your agency' }, { status: 400 });
            }
            updateData.outbound_agent_id = body.outbound_agent_id || null;
        }

        // Sync agent assignment to the provider
        if (existing.external_id && existing.provider) {
            const { data: agency } = await supabase
                .from('agencies')
                .select('retell_api_key, vapi_api_key, bland_api_key')
                .eq('id', user.agency.id)
                .single();

            // Decrypt API keys from DB
            if (agency) {
                agency.retell_api_key = decrypt(agency.retell_api_key) ?? agency.retell_api_key;
                agency.vapi_api_key = decrypt(agency.vapi_api_key) ?? agency.vapi_api_key;
                agency.bland_api_key = decrypt(agency.bland_api_key) ?? agency.bland_api_key;
            }

            // Helper: resolve agent's external_id by our internal ID
            const resolveAgentExternalId = async (agentId: string | null | undefined): Promise<string | null> => {
                if (!agentId) return null;
                const { data: agent } = await supabase
                    .from('agents')
                    .select('external_id')
                    .eq('id', agentId)
                    .eq('agency_id', user.agency.id)
                    .single();
                return agent?.external_id || null;
            };

            try {
                if (existing.provider === 'retell' && agency?.retell_api_key) {
                    const retellUpdate: Record<string, string | null> = {};

                    if (body.inbound_agent_id !== undefined || body.agent_id !== undefined) {
                        const agentId = body.inbound_agent_id ?? body.agent_id;
                        retellUpdate.inbound_agent_id = await resolveAgentExternalId(agentId);
                    }
                    if (body.outbound_agent_id !== undefined) {
                        retellUpdate.outbound_agent_id = await resolveAgentExternalId(body.outbound_agent_id);
                    }

                    if (Object.keys(retellUpdate).length > 0) {
                        const retellRes = await fetch(`https://api.retellai.com/update-phone-number/${encodeURIComponent(existing.external_id)}`, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${agency.retell_api_key}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(retellUpdate),
                            signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                        });
                        if (!retellRes.ok) {
                            console.error('Retell phone number update failed:', retellRes.status);
                            return NextResponse.json({ error: 'Failed to update phone number with provider' }, { status: 502 });
                        }
                    }
                } else if (existing.provider === 'vapi' && agency?.vapi_api_key) {
                    // Vapi uses assistantId for inbound routing
                    if (body.inbound_agent_id !== undefined || body.agent_id !== undefined) {
                        const agentId = body.inbound_agent_id ?? body.agent_id;
                        const externalAgentId = await resolveAgentExternalId(agentId);

                        const vapiRes = await fetch(`https://api.vapi.ai/phone-number/${encodeURIComponent(existing.external_id)}`, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${agency.vapi_api_key}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ assistantId: externalAgentId }),
                            signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                        });
                        if (!vapiRes.ok) {
                            console.error('Vapi phone number update failed:', vapiRes.status);
                            return NextResponse.json({ error: 'Failed to update phone number with provider' }, { status: 502 });
                        }
                    }
                } else if (existing.provider === 'bland' && agency?.bland_api_key) {
                    // Bland inbound routing update
                    if (body.inbound_agent_id !== undefined || body.agent_id !== undefined) {
                        const agentId = body.inbound_agent_id ?? body.agent_id;
                        const externalAgentId = await resolveAgentExternalId(agentId);

                        if (externalAgentId) {
                            const blandRes = await fetch(`https://api.bland.ai/v1/inbound/${encodeURIComponent(existing.external_id)}`, {
                                method: 'POST',
                                headers: { 'Authorization': agency.bland_api_key, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pathway_id: externalAgentId }),
                                signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                            });
                            if (!blandRes.ok) {
                                console.error('Bland phone number update failed:', blandRes.status);
                            }
                        }
                    }
                }
            } catch (providerErr) {
                console.error('Provider phone update error:', providerErr instanceof Error ? providerErr.message : 'Unknown error');
                return NextResponse.json({ error: 'Failed to update phone number with provider' }, { status: 502 });
            }
        }

        const { data: phoneNumber, error } = await supabase
            .from('phone_numbers')
            .update(updateData)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .select(`
                *,
                inbound_agent:agents!phone_numbers_inbound_agent_id_fkey(id, name),
                outbound_agent:agents!phone_numbers_outbound_agent_id_fkey(id, name)
            `)
            .single();

        if (error) {
            console.error('Error updating phone number:', error.code);
            return NextResponse.json({ error: 'Failed to update phone number' }, { status: 500 });
        }

        return NextResponse.json({ data: phoneNumber });
    } catch (error) {
        console.error('Error updating phone number:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/phone-numbers/[id] - Release phone number
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = await createClient();

        // Get phone number
        const { data: phoneNumber } = await supabase
            .from('phone_numbers')
            .select('external_id, provider, phone_number')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
        }

        // Get API keys and release from the appropriate provider
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        // Decrypt API keys from DB
        if (agency) {
            agency.retell_api_key = decrypt(agency.retell_api_key) ?? agency.retell_api_key;
            agency.vapi_api_key = decrypt(agency.vapi_api_key) ?? agency.vapi_api_key;
            agency.bland_api_key = decrypt(agency.bland_api_key) ?? agency.bland_api_key;
        }

        if (phoneNumber.external_id) {
            try {
                if (phoneNumber.provider === 'retell' && agency?.retell_api_key) {
                    const deleteRes = await fetch(`https://api.retellai.com/v2/delete-phone-number/${encodeURIComponent(phoneNumber.external_id)}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${agency.retell_api_key}` },
                        signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                    });
                    if (!deleteRes.ok) console.error('Retell phone delete failed:', deleteRes.status);
                } else if (phoneNumber.provider === 'vapi' && agency?.vapi_api_key) {
                    const deleteRes = await fetch(`https://api.vapi.ai/phone-number/${encodeURIComponent(phoneNumber.external_id)}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${agency.vapi_api_key}` },
                        signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                    });
                    if (!deleteRes.ok) console.error('Vapi phone delete failed:', deleteRes.status);
                } else if (phoneNumber.provider === 'bland' && agency?.bland_api_key) {
                    const deleteRes = await fetch(`https://api.bland.ai/v1/inbound/${encodeURIComponent(phoneNumber.phone_number)}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': agency.bland_api_key, 'Content-Type': 'application/json' },
                        signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                    });
                    if (!deleteRes.ok) console.error('Bland phone delete failed:', deleteRes.status);
                }
            } catch (providerErr) {
                console.error('Provider phone delete error:', providerErr instanceof Error ? providerErr.message : 'Unknown error');
            }
        }

        // Mark as released in our DB (agency_id check for defense-in-depth)
        await supabase
            .from('phone_numbers')
            .update({
                status: 'released',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error releasing phone number:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
