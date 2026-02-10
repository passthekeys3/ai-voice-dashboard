/**
 * Slack Webhook Test Endpoint
 *
 * POST /api/integrations/slack/test
 * Sends a test message to verify the Slack webhook URL works.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { testSlackWebhook, isValidSlackWebhookUrl } from '@/lib/integrations/slack';

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user || !isAgencyAdmin(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { webhook_url?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const webhookUrl = body.webhook_url?.trim();
    if (!webhookUrl) {
        return NextResponse.json({ error: 'webhook_url is required' }, { status: 400 });
    }

    if (!isValidSlackWebhookUrl(webhookUrl)) {
        return NextResponse.json(
            { error: 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/' },
            { status: 400 },
        );
    }

    const result = await testSlackWebhook(webhookUrl);

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Test message sent to Slack' });
}
