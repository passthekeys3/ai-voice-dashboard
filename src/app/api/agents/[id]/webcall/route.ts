import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import { isValidUuid } from '@/lib/validation';
import { decrypt } from '@/lib/crypto';
import { checkRateLimitAsync } from '@/lib/rate-limit';

const PROVIDER_API_TIMEOUT = 15_000;
const WEBCALL_RATE_LIMIT = { windowMs: 60_000, maxRequests: 5 };

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

        const rl = await checkRateLimitAsync(`webcall:${user.id}`, WEBCALL_RATE_LIMIT);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many test calls. Please wait a minute before trying again.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetTime - Date.now()) / 1000)) } }
            );
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
            if (!providerKey) {
                return NextResponse.json({ error: 'No Vapi API key configured' }, { status: 400 });
            }

            // Vapi public key is not part of resolve-keys; fetch from agency directly
            const { data: agency } = await supabase
                .from('agencies')
                .select('vapi_public_key')
                .eq('id', user.agency.id)
                .single();

            const vapiPublicKey = decrypt(agency?.vapi_public_key) ?? agency?.vapi_public_key;
            if (!vapiPublicKey) {
                return NextResponse.json({
                    error: 'Vapi Public Key is required for test calls. Add it in Settings under "Vapi Public Key".'
                }, { status: 400 });
            }

            // For Vapi, the web SDK handles call creation client-side using the public key.
            // We just return the public key and assistant ID so the client can connect.
            return NextResponse.json({
                data: {
                    provider: 'vapi',
                    vapi_public_key: vapiPublicKey,
                    assistant_id: agent.external_id,
                }
            });
        } else if (agent.provider === 'bland') {
            if (!providerKey) {
                return NextResponse.json({ error: 'No Bland API key configured' }, { status: 400 });
            }

            // Bland has no browser SDK — outbound phone call only.
            // Requires a phone_number in the request body.
            let body: { phone_number?: string } = {};
            try {
                body = await request.json();
            } catch {
                // Empty body is fine — we'll return an error below
            }

            const phoneNumber = body.phone_number;
            if (!phoneNumber || typeof phoneNumber !== 'string') {
                return NextResponse.json({
                    error: 'Bland agents require a phone number for test calls. Provide phone_number in the request body.'
                }, { status: 400 });
            }

            // Validate phone format (E.164-ish: starts with + and digits, or just digits)
            const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
            if (!/^\+?\d{10,15}$/.test(cleaned)) {
                return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
            }

            // Block premium-rate numbers (900, 976, international premium prefixes)
            const digits = cleaned.replace(/^\+?1?/, ''); // Strip country code for US/CA
            const premiumPrefixes = ['900', '976', '550', '700'];
            if (premiumPrefixes.some(p => digits.startsWith(p))) {
                return NextResponse.json({ error: 'Premium-rate numbers are not allowed for test calls' }, { status: 400 });
            }
            // Block international premium (UK 09, AU 19, etc.)
            if (/^\+44(9|70)/.test(cleaned) || /^\+6119/.test(cleaned)) {
                return NextResponse.json({ error: 'Premium-rate numbers are not allowed for test calls' }, { status: 400 });
            }

            // Initiate outbound call via Bland API
            const blandResponse = await fetch('https://api.bland.ai/v1/calls', {
                method: 'POST',
                headers: {
                    'authorization': providerKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone_number: cleaned,
                    pathway_id: agent.external_id,
                    wait_for_greeting: true,
                }),
                signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
            });

            if (!blandResponse.ok) {
                console.error('Bland outbound call error:', blandResponse.status);
                return NextResponse.json({ error: 'Failed to initiate test call' }, { status: 500 });
            }

            const blandCall = await blandResponse.json();

            return NextResponse.json({
                data: {
                    provider: 'bland',
                    call_id: blandCall.call_id,
                    status: blandCall.status || 'queued',
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
