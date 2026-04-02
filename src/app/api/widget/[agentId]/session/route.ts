import { NextRequest, NextResponse } from 'next/server';
import type { VoiceProvider } from '@/types';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { isValidUuid } from '@/lib/validation';

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

/** Widget session: 10 sessions per agent per minute */
const WIDGET_SESSION_RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };
const PROVIDER_API_TIMEOUT = 15_000;

/**
 * POST /api/widget/[agentId]/session
 *
 * Public endpoint to create a web call session for the embeddable voice widget.
 * No dashboard authentication required — secured by:
 *   - Agent must have widget_enabled = true
 *   - Agent must be is_active = true
 *   - In-code rate limiting (per agent, 10/min)
 *   - Middleware rate limiting (per IP)
 *
 * Returns an access_token that the widget UI uses to start the call via the
 * provider's client SDK (Retell).
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
) {
    try {
        const { agentId } = await params;

        if (!agentId) {
            return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
        }

        // Validate UUID format to fail fast before hitting the database
        if (!isValidUuid(agentId)) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // In-code rate limit per agent (defense-in-depth alongside middleware IP-based limiting)
        const rl = await checkRateLimitAsync(`widget:${agentId}`, WIDGET_SESSION_RATE_LIMIT);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rl.resetTime - Date.now()) / 1000)),
                    },
                }
            );
        }

        const supabase = createServiceClient();

        // Look up agent with widget enabled
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, provider, external_id, agency_id, client_id, is_active, widget_enabled, widget_config, config')
            .eq('id', agentId)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Check allowed origins if configured (optional security restriction)
        const rawWidgetConfig = agent.widget_config as Record<string, unknown> | null;
        const allowedOrigins = rawWidgetConfig?.allowed_origins as string[] | undefined;
        if (allowedOrigins && allowedOrigins.length > 0) {
            const origin = request.headers.get('origin') || '';
            if (!allowedOrigins.some(allowed => origin === allowed || origin.endsWith(`.${allowed.replace(/^https?:\/\//, '')}`))) {
                return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
            }
        }

        if (!agent.is_active) {
            return NextResponse.json({ error: 'Agent is not active' }, { status: 403 });
        }

        if (!agent.widget_enabled) {
            return NextResponse.json({ error: 'Widget is not enabled for this agent' }, { status: 403 });
        }

        // Resolve API keys (client-level override when applicable)
        const resolvedKeys = await resolveProviderApiKeys(supabase, agent.agency_id, agent.client_id);
        const providerKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        // Get agency branding (always from agency level)
        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('branding')
            .eq('id', agent.agency_id)
            .single();

        if (agencyError || !agency) {
            return NextResponse.json({ error: 'Agency configuration error' }, { status: 500 });
        }

        let accessToken: string;
        let callId: string;

        if (agent.provider === 'retell') {
            if (!providerKey) {
                return NextResponse.json({ error: 'Voice provider not configured' }, { status: 500 });
            }

            // Create web call via Retell API
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
                console.error('Retell web call creation failed:', retellResponse.status);
                return NextResponse.json({ error: 'Failed to create call session' }, { status: 500 });
            }

            const webCall = await retellResponse.json();
            accessToken = webCall.access_token;
            callId = webCall.call_id;
        } else if (agent.provider === 'vapi') {
            // Vapi web call support — future implementation
            return NextResponse.json(
                { error: 'Web calls for Vapi agents are not yet supported. Please use a Retell agent.' },
                { status: 400 }
            );
        } else if (agent.provider === 'bland') {
            // Bland web call support — future implementation
            return NextResponse.json(
                { error: 'Web calls for Bland.ai agents are not yet supported. Please use a Retell agent.' },
                { status: 400 }
            );
        } else {
            return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
        }

        // Merge widget config with agency branding defaults
        // Validate avatar_url to prevent javascript:/data: scheme injection
        let avatarUrl: string | null = agent.widget_config?.avatar_url || null;
        if (avatarUrl) {
            try {
                const parsed = new URL(avatarUrl);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    avatarUrl = null; // Block non-HTTP schemes (javascript:, data:, etc.)
                }
            } catch {
                avatarUrl = null; // Invalid URL
            }
        }

        const widgetConfig = {
            color: agent.widget_config?.color || agency.branding?.primary_color || '#0f172a',
            position: agent.widget_config?.position || 'right',
            greeting: agent.widget_config?.greeting || `Talk to ${agent.name}`,
            avatar_url: avatarUrl,
        };

        return NextResponse.json({
            access_token: accessToken,
            call_id: callId,
            provider: agent.provider,
            agent_name: agent.name,
            widget_config: widgetConfig,
        });
    } catch (error) {
        console.error('Widget session error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
