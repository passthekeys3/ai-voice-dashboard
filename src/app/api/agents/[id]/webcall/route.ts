import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import { isValidUuid } from '@/lib/validation';

const PROVIDER_API_TIMEOUT = 15_000;

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/agents/[id]/webcall - Create a web call for testing
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId } = await params;
        if (!isValidUuid(agentId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = createServiceClient();

        // Get agent details
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('external_id, provider, agency_id, client_id')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Resolve API keys (client-level override when applicable)
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const providerKey = getProviderKey(resolvedKeys, agent.provider as 'retell' | 'vapi' | 'bland');

        if (agent.provider === 'retell') {
            if (!providerKey) {
                return NextResponse.json({ error: 'No Retell API key configured' }, { status: 400 });
            }

            // Create web call with Retell API
            const retellResponse = await fetch('https://api.retellai.com/v2/create-web-call', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${providerKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    agent_id: agent.external_id,
                }),
                signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
            });

            if (!retellResponse.ok) {
                console.error('Retell web call error:', retellResponse.status);
                return NextResponse.json({ error: 'Failed to create web call' }, { status: 500 });
            }

            const webCall = await retellResponse.json();

            return NextResponse.json({
                data: {
                    provider: 'retell',
                    access_token: webCall.access_token,
                    call_id: webCall.call_id,
                }
            });
        } else if (agent.provider === 'vapi') {
            // Vapi public key is not part of resolve-keys; fetch from agency directly
            const { data: agency } = await supabase
                .from('agencies')
                .select('vapi_public_key')
                .eq('id', user.agency.id)
                .single();

            if (!agency?.vapi_public_key) {
                return NextResponse.json({
                    error: 'Vapi Public Key is required for test calls. Add it in Settings under "Vapi Public Key".'
                }, { status: 400 });
            }

            // For Vapi, the web SDK handles call creation client-side using the public key.
            // We just return the public key and assistant ID so the client can connect.
            return NextResponse.json({
                data: {
                    provider: 'vapi',
                    vapi_public_key: agency.vapi_public_key,
                    assistant_id: agent.external_id,
                }
            });
        } else {
            return NextResponse.json({
                error: `Web calls are not yet supported for ${agent.provider} agents`
            }, { status: 400 });
        }
    } catch (error) {
        console.error('Error creating web call:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
