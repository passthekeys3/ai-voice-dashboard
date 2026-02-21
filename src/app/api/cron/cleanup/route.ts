import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Data Cleanup Cron
 *
 * POST /api/cron/cleanup
 *
 * Runs weekly to clean up old log entries and prevent unbounded table growth.
 * - Trigger logs (api, ghl, hubspot): 90 days retention
 * - Workflow execution logs: 90 days retention
 * - Completed scheduled calls: 30 days retention
 *
 * Protected by CRON_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET not configured - rejecting cron request for security');
            return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
        }

        const expected = `Bearer ${cronSecret}`;
        if (!authHeader || authHeader.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const results: { table: string; deleted: number; error?: string }[] = [];

        // Clean up API trigger logs (90 days)
        const { count: apiTriggerCount, error: apiTriggerErr } = await supabase
            .from('api_trigger_log')
            .delete({ count: 'exact' })
            .lt('created_at', ninetyDaysAgo);

        results.push({
            table: 'api_trigger_log',
            deleted: apiTriggerCount || 0,
            ...(apiTriggerErr && { error: apiTriggerErr.message }),
        });

        // Clean up GHL trigger logs (90 days)
        const { count: ghlCount, error: ghlErr } = await supabase
            .from('ghl_trigger_log')
            .delete({ count: 'exact' })
            .lt('created_at', ninetyDaysAgo);

        results.push({
            table: 'ghl_trigger_log',
            deleted: ghlCount || 0,
            ...(ghlErr && { error: ghlErr.message }),
        });

        // Clean up HubSpot trigger logs (90 days)
        const { count: hubspotCount, error: hubspotErr } = await supabase
            .from('hubspot_trigger_log')
            .delete({ count: 'exact' })
            .lt('created_at', ninetyDaysAgo);

        results.push({
            table: 'hubspot_trigger_log',
            deleted: hubspotCount || 0,
            ...(hubspotErr && { error: hubspotErr.message }),
        });

        // Clean up workflow execution logs (90 days)
        const { count: workflowCount, error: workflowErr } = await supabase
            .from('workflow_execution_log')
            .delete({ count: 'exact' })
            .lt('created_at', ninetyDaysAgo);

        results.push({
            table: 'workflow_execution_log',
            deleted: workflowCount || 0,
            ...(workflowErr && { error: workflowErr.message }),
        });

        // Clean up completed/failed scheduled calls (30 days)
        const { count: scheduledCount, error: scheduledErr } = await supabase
            .from('scheduled_calls')
            .delete({ count: 'exact' })
            .in('status', ['completed', 'failed'])
            .lt('updated_at', thirtyDaysAgo);

        results.push({
            table: 'scheduled_calls (completed/failed)',
            deleted: scheduledCount || 0,
            ...(scheduledErr && { error: scheduledErr.message }),
        });

        const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
        const errors = results.filter(r => r.error);

        console.log(`Data cleanup completed: ${totalDeleted} rows deleted across ${results.length} tables`);
        if (errors.length > 0) {
            console.warn('Cleanup errors:', errors);
        }

        return NextResponse.json({
            success: true,
            totalDeleted,
            results,
        });
    } catch (error) {
        console.error('Data cleanup cron error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
