import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { initiateCall, type CallInitiationParams } from '@/lib/calls/initiate';
import { isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import { applyExperiment } from '@/lib/experiments/apply';

// This endpoint should be called by a cron job every minute
// Example: Vercel Cron, or external service like cron-job.org

// POST /api/cron/process-scheduled-calls
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret (for security) - FAIL SECURE: require secret to be configured
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET not configured - rejecting cron request for security');
            return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();
        const now = new Date().toISOString();

        // Find all pending calls that are due
        const { data: dueCalls, error: fetchError } = await supabase
            .from('scheduled_calls')
            .select('*, agent:agents(external_id, provider, agency_id, agencies(retell_api_key, vapi_api_key, bland_api_key, calling_window))')
            .eq('status', 'pending')
            .lte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(50); // Process up to 50 at a time (fits within Vercel Pro 60s timeout)

        if (fetchError) {
            console.error('Error fetching due calls:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch scheduled calls' }, { status: 500 });
        }

        if (!dueCalls || dueCalls.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No calls due' });
        }

        const results: { id: string; status: string; error?: string }[] = [];

        for (const call of dueCalls) {
            // Use optimistic locking to prevent race conditions
            // Only update if status is still 'pending' (atomic check-and-update)
            const { data: lockedCall, error: lockError } = await supabase
                .from('scheduled_calls')
                .update({
                    status: 'in_progress',
                    updated_at: new Date().toISOString()
                })
                .eq('id', call.id)
                .eq('status', 'pending')  // Only if still pending (optimistic lock)
                .select()
                .single();

            // If no row was updated, another process grabbed it - skip
            if (lockError || !lockedCall) {
                console.log(`Scheduled call ${call.id} already being processed by another worker`);
                continue;
            }

            try {
                // Re-check calling window before initiating (handles DST changes, config changes)
                const callingWindow = call.agent?.agencies?.calling_window;
                const leadTimezone = call.lead_timezone;

                if (callingWindow?.enabled && leadTimezone) {
                    const windowConfig = {
                        startHour: callingWindow.start_hour,
                        endHour: callingWindow.end_hour,
                        daysOfWeek: callingWindow.days_of_week,
                    };

                    if (!isWithinCallingWindow(leadTimezone, windowConfig)) {
                        // Reschedule to next valid time
                        const nextValid = getNextValidCallTime(leadTimezone, windowConfig);
                        await supabase
                            .from('scheduled_calls')
                            .update({
                                status: 'pending',
                                scheduled_at: nextValid.toISOString(),
                                timezone_delayed: true,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', call.id);

                        results.push({ id: call.id, status: 'rescheduled' });
                        console.log(`Scheduled call ${call.id} rescheduled to ${nextValid.toISOString()} (outside calling window in ${leadTimezone})`);
                        continue;
                    }
                }

                // Determine provider and API key
                const provider = call.agent?.provider || 'retell';
                const externalAgentId = call.agent?.external_id;
                const providerApiKey = provider === 'vapi'
                    ? call.agent?.agencies?.vapi_api_key
                    : provider === 'bland'
                    ? call.agent?.agencies?.bland_api_key
                    : call.agent?.agencies?.retell_api_key;

                if (!providerApiKey || !externalAgentId) {
                    throw new Error(`Missing ${provider} API key or agent external ID`);
                }

                // Log if call is significantly delayed
                const scheduledTime = new Date(call.scheduled_at).getTime();
                const actualTime = Date.now();
                const delayMinutes = (actualTime - scheduledTime) / (1000 * 60);
                if (delayMinutes > 5) {
                    console.warn(`Scheduled call ${call.id} is ${delayMinutes.toFixed(1)} minutes late`);
                }

                // Initiate call via provider-agnostic module
                // Resolve A/B experiment before initiating
                let callInitParams: CallInitiationParams = {
                    provider: provider as 'retell' | 'vapi' | 'bland',
                    providerApiKey,
                    externalAgentId,
                    toNumber: call.to_number,
                    metadata: {
                        scheduled_call_id: call.id,
                        contact_name: call.contact_name,
                        notes: call.notes,
                        lead_timezone: call.lead_timezone,
                        ...(call.metadata || {}),
                    },
                };

                const experimentResult = await applyExperiment({
                    agentId: call.agent_id,
                    agencyId: call.agency_id,
                    callParams: callInitParams,
                });
                callInitParams = experimentResult.callParams;

                const callResult = await initiateCall(callInitParams);

                if (!callResult.success) {
                    throw new Error(callResult.error || 'Call initiation failed');
                }

                // Mark as completed (call initiated)
                await supabase
                    .from('scheduled_calls')
                    .update({
                        status: 'completed',
                        external_call_id: callResult.callId,
                        completed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', call.id);

                results.push({ id: call.id, status: 'completed' });
                console.log(`Scheduled call ${call.id} initiated via ${provider}, call ID: ${callResult.callId}`);

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';

                // Check retry count
                const newRetryCount = (call.retry_count || 0) + 1;
                const maxRetries = call.max_retries || 2;

                if (newRetryCount >= maxRetries) {
                    // Mark as failed
                    await supabase
                        .from('scheduled_calls')
                        .update({
                            status: 'failed',
                            error_message: errorMessage,
                            retry_count: newRetryCount,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', call.id);

                    results.push({ id: call.id, status: 'failed', error: errorMessage });
                    console.error(`Scheduled call ${call.id} failed permanently: ${errorMessage}`);
                } else {
                    // Reset to pending for retry
                    await supabase
                        .from('scheduled_calls')
                        .update({
                            status: 'pending',
                            error_message: errorMessage,
                            retry_count: newRetryCount,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', call.id);

                    results.push({ id: call.id, status: 'retry', error: errorMessage });
                    console.warn(`Scheduled call ${call.id} will retry (${newRetryCount}/${maxRetries}): ${errorMessage}`);
                }
            }
        }

        return NextResponse.json({
            processed: results.length,
            results,
        });
    } catch (error) {
        console.error('Error processing scheduled calls:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
