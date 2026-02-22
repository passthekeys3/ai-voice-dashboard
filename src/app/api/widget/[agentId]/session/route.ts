import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/widget/[agentId]/session
 *
 * Public endpoint to create a web call session for the embeddable voice widget.
 * No dashboard authentication required — secured by:
 *   - Agent must have widget_enabled = true
 *   - Agent must be is_active = true
 *   - Rate limiting (handled by middleware)
 *
 * Returns an access_token that the widget UI uses to start the call via the
 * provider's client SDK (Retell).
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
) {
    try {
        const { agentId } = await params;

        if (!agentId) {
            return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Look up agent with widget enabled
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, provider, external_id, agency_id, is_active, widget_enabled, widget_config, config')
            .eq('id', agentId)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (!agent.is_active) {
            return NextResponse.json({ error: 'Agent is not active' }, { status: 403 });
        }

        if (!agent.widget_enabled) {
            return NextResponse.json({ error: 'Widget is not enabled for this agent' }, { status: 403 });
        }

        // Get agency API key and branding
        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key, branding')
            .eq('id', agent.agency_id)
            .single();

        if (agencyError || !agency) {
            return NextResponse.json({ error: 'Agency configuration error' }, { status: 500 });
        }

        let accessToken: string;
        let callId: string;

        if (agent.provider === 'retell') {
            if (!agency.retell_api_key) {
                return NextResponse.json({ error: 'Voice provider not configured' }, { status: 500 });
            }

            // Create web call via Retell API
            const retellResponse = await fetch('https://api.retellai.com/v2/create-web-call', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${agency.retell_api_key}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    agent_id: agent.external_id,
                }),
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
        const widgetConfig = {
            color: agent.widget_config?.color || agency.branding?.primary_color || '#0f172a',
            position: agent.widget_config?.position || 'right',
            greeting: agent.widget_config?.greeting || `Talk to ${agent.name}`,
            avatar_url: agent.widget_config?.avatar_url || null,
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
