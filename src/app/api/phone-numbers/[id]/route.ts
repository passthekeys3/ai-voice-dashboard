import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/phone-numbers/[id] - Get a phone number
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
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
        console.error('Error fetching phone number:', error);
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
        const body = await request.json();
        const supabase = await createClient();

        // Verify ownership
        const { data: existing } = await supabase
            .from('phone_numbers')
            .select('id, external_id')
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

        // Update in Retell if external_id exists
        if (existing.external_id) {
            const { data: agency } = await supabase
                .from('agencies')
                .select('retell_api_key')
                .eq('id', user.agency.id)
                .single();

            if (agency?.retell_api_key) {
                const retellUpdate: Record<string, string | null> = {};

                // Get inbound agent's external ID
                if (body.inbound_agent_id !== undefined || body.agent_id !== undefined) {
                    const agentId = body.inbound_agent_id ?? body.agent_id;
                    if (agentId) {
                        const { data: agent } = await supabase
                            .from('agents')
                            .select('external_id')
                            .eq('id', agentId)
                            .eq('agency_id', user.agency.id)
                            .single();
                        retellUpdate.inbound_agent_id = agent?.external_id || null;
                    } else {
                        retellUpdate.inbound_agent_id = null;
                    }
                }

                // Get outbound agent's external ID
                if (body.outbound_agent_id !== undefined) {
                    if (body.outbound_agent_id) {
                        const { data: agent } = await supabase
                            .from('agents')
                            .select('external_id')
                            .eq('id', body.outbound_agent_id)
                            .eq('agency_id', user.agency.id)
                            .single();
                        retellUpdate.outbound_agent_id = agent?.external_id || null;
                    } else {
                        retellUpdate.outbound_agent_id = null;
                    }
                }

                // Update phone number in Retell
                if (Object.keys(retellUpdate).length > 0) {
                    const retellRes = await fetch(`https://api.retellai.com/update-phone-number/${existing.external_id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${agency.retell_api_key}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(retellUpdate),
                    });
                    if (!retellRes.ok) {
                        console.error('Retell phone number update failed:', retellRes.status);
                        return NextResponse.json({ error: 'Failed to update phone number with provider' }, { status: 502 });
                    }
                }
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
            console.error('Error updating phone number:', error);
            return NextResponse.json({ error: 'Failed to update phone number' }, { status: 500 });
        }

        return NextResponse.json({ data: phoneNumber });
    } catch (error) {
        console.error('Error updating phone number:', error);
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
        const supabase = await createClient();

        // Get phone number
        const { data: phoneNumber } = await supabase
            .from('phone_numbers')
            .select('external_id')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
        }

        // Get API key and delete from Retell
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (agency?.retell_api_key && phoneNumber.external_id) {
            await fetch(`https://api.retellai.com/v2/delete-phone-number/${phoneNumber.external_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${agency.retell_api_key}`,
                },
            });
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
        console.error('Error releasing phone number:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
