import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { forwardToWebhook } from '@/lib/webhooks/forward';

/**
 * POST /api/webhooks/test
 *
 * Sends a test webhook payload to the configured webhook URL.
 * Useful for validating Zapier/Make/n8n integrations before a real call.
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createAdminClient();
        const { data: agency } = await supabase
            .from('agencies')
            .select('id, integrations')
            .eq('id', user.agency.id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        const apiConfig = agency.integrations?.api;
        if (!apiConfig?.webhook_url) {
            return NextResponse.json({ error: 'No webhook URL configured' }, { status: 400 });
        }

        // Sample payload that mirrors a real call_ended event
        const testPayload = {
            event: 'call_ended',
            test: true,
            call_id: `test_${Date.now()}`,
            agent_id: 'test-agent-id',
            agent_name: 'Test Agent',
            status: 'completed',
            direction: 'outbound',
            duration_seconds: 120,
            cost_cents: 25,
            from_number: '+14155551234',
            to_number: '+14155555678',
            transcript: 'Agent: Hello, this is a test call.\nUser: Hi, thanks for calling.',
            recording_url: null,
            summary: 'This is a test webhook to verify your integration is working correctly.',
            sentiment: 'positive',
            started_at: new Date(Date.now() - 120_000).toISOString(),
            ended_at: new Date().toISOString(),
            metadata: { source: 'webhook_test' },
            provider: 'test',
        };

        const result = await forwardToWebhook(supabase, {
            webhookUrl: apiConfig.webhook_url,
            payload: testPayload,
            signingSecret: apiConfig.webhook_signing_secret,
            agencyId: agency.id,
            callId: testPayload.call_id,
            event: 'test',
        });

        return NextResponse.json({
            success: result.success,
            status_code: result.statusCode,
            error: result.error,
        });
    } catch (err) {
        console.error('Webhook test error:', err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
