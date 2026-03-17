import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { detectTimezone, isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import { isValidUuid, safeParseJson } from '@/lib/validation';
import { normalizePhoneToE164 } from '@/lib/validation/phone';
import type { CallingWindowConfig } from '@/types';
import { withErrorHandling } from '@/lib/api/response';

// GET /api/scheduled-calls - List scheduled calls
export const GET = withErrorHandling(async (request: NextRequest) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const agentId = searchParams.get('agent_id');

        let query = supabase
            .from('scheduled_calls')
            .select('*, agent:agents(name, external_id)')
            .eq('agency_id', user.agency.id)
            .order('scheduled_at', { ascending: true });

        // Non-admin client users can only see scheduled calls for their client's agents
        if (!isAgencyAdmin(user)) {
            if (user.profile.client_id) {
                // Get agent IDs belonging to this client
                const { data: clientAgents } = await supabase
                    .from('agents')
                    .select('id')
                    .eq('agency_id', user.agency.id)
                    .eq('client_id', user.profile.client_id);

                const clientAgentIds = clientAgents?.map(a => a.id) || [];
                if (clientAgentIds.length === 0) {
                    return NextResponse.json({ data: [] });
                }
                query = query.in('agent_id', clientAgentIds);
            } else {
                // Non-admin user with no client — no scheduled calls to show
                return NextResponse.json({ data: [] });
            }
        }

        if (status) {
            const VALID_SCHEDULED_STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'];
            if (!VALID_SCHEDULED_STATUSES.includes(status)) {
                return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_SCHEDULED_STATUSES.join(', ')}` }, { status: 400 });
            }
            query = query.eq('status', status);
        }

        if (agentId) {
            // Validate UUID format and verify agent belongs to this agency (defense-in-depth)
            if (!isValidUuid(agentId)) {
                return NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });
            }
            const { data: agentCheck } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agentId)
                .eq('agency_id', user.agency.id)
                .single();
            if (!agentCheck) {
                return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
            }
            query = query.eq('agent_id', agentId);
        }

        const { data: scheduledCalls, error } = await query.limit(200);

        if (error) {
            console.error('Error fetching scheduled calls:', error.code);
            return NextResponse.json({ error: 'Failed to fetch scheduled calls' }, { status: 500 });
        }

        return NextResponse.json({ data: scheduledCalls });
    } catch (error) {
        console.error('Error fetching scheduled calls:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

// POST /api/scheduled-calls - Schedule a new call
export const POST = withErrorHandling(async (request: NextRequest) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const { agent_id, to_number, contact_name, scheduled_at, notes, metadata } = bodyOrError;

        if (!agent_id) {
            return NextResponse.json({ error: 'Agent is required' }, { status: 400 });
        }

        if (!to_number) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Validate and normalize phone number to E.164 format
        const normalized = normalizePhoneToE164(to_number);
        if ('error' in normalized) {
            return NextResponse.json({ error: normalized.error }, { status: 400 });
        }
        const cleanedNumber = normalized.phone;

        if (!scheduled_at) {
            return NextResponse.json({ error: 'Scheduled time is required' }, { status: 400 });
        }

        const scheduledDate = new Date(scheduled_at);
        if (scheduledDate < new Date()) {
            return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
        }

        const supabase = await createClient();

        // Verify agent belongs to this agency
        const { data: agent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agent_id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Detect lead timezone from phone number
        const leadTimezone = detectTimezone(cleanedNumber);

        // Check calling window enforcement
        let finalScheduledAt = scheduledDate;
        let originalScheduledAt: string | undefined;
        let timezoneDelayed = false;

        const callingWindow = user.agency.calling_window ??
            (user.agency.integrations?.ghl?.calling_window as CallingWindowConfig | undefined);

        if (callingWindow?.enabled) {
            const tz = callingWindow.timezone_override || leadTimezone || 'America/New_York';
            const windowConfig = {
                startHour: callingWindow.start_hour,
                endHour: callingWindow.end_hour,
                daysOfWeek: callingWindow.days_of_week,
            };

            // Check if the requested time falls within the calling window
            // For future-scheduled calls, check what the local time will be at the scheduled moment
            if (!isWithinCallingWindow(tz, windowConfig, scheduledDate)) {
                // Auto-delay to the next valid calling time
                originalScheduledAt = scheduledDate.toISOString();
                finalScheduledAt = getNextValidCallTime(
                    tz,
                    windowConfig,
                );
                timezoneDelayed = true;
            }
        }

        const { data: scheduledCall, error } = await supabase
            .from('scheduled_calls')
            .insert({
                agency_id: user.agency.id,
                agent_id,
                to_number: cleanedNumber,
                contact_name,
                scheduled_at: finalScheduledAt.toISOString(),
                notes,
                metadata,
                created_by: user.id,
                lead_timezone: leadTimezone,
                original_scheduled_at: originalScheduledAt,
                timezone_delayed: timezoneDelayed,
                trigger_source: 'manual',
            })
            .select('*, agent:agents(name, external_id)')
            .single();

        if (error) {
            console.error('Error creating scheduled call:', error.code);
            return NextResponse.json({ error: 'Failed to create scheduled call' }, { status: 500 });
        }

        return NextResponse.json({
            data: scheduledCall,
            ...(timezoneDelayed ? {
                timezone_info: {
                    lead_timezone: leadTimezone,
                    original_time: originalScheduledAt,
                    adjusted_time: finalScheduledAt.toISOString(),
                    reason: 'Adjusted to comply with calling window',
                },
            } : {}),
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating scheduled call:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
