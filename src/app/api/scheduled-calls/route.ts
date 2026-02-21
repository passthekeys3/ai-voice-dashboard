import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { detectTimezone, isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import type { CallingWindowConfig } from '@/types';

// GET /api/scheduled-calls - List scheduled calls
export async function GET(request: NextRequest) {
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
            query = query.eq('status', status);
        }

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        const { data: scheduledCalls, error } = await query;

        if (error) {
            console.error('Error fetching scheduled calls:', error);
            return NextResponse.json({ error: 'Failed to fetch scheduled calls' }, { status: 500 });
        }

        return NextResponse.json({ data: scheduledCalls });
    } catch (error) {
        console.error('Error fetching scheduled calls:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/scheduled-calls - Schedule a new call
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { agent_id, to_number, contact_name, scheduled_at, notes, metadata } = body;

        if (!agent_id) {
            return NextResponse.json({ error: 'Agent is required' }, { status: 400 });
        }

        if (!to_number) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Validate phone number format (E.164 format: +[country code][number])
        const phoneRegex = /^\+[1-9]\d{6,14}$/;
        const cleanedNumber = to_number.replace(/[\s\-\(\)]/g, ''); // Remove common formatting
        if (!phoneRegex.test(cleanedNumber)) {
            return NextResponse.json({
                error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)'
            }, { status: 400 });
        }

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

        if (callingWindow?.enabled && leadTimezone) {
            const windowConfig = {
                startHour: callingWindow.start_hour,
                endHour: callingWindow.end_hour,
                daysOfWeek: callingWindow.days_of_week,
            };

            // Check if the requested time falls within the calling window
            // For future-scheduled calls, check what the local time will be at the scheduled moment
            if (!isWithinCallingWindow(callingWindow.timezone_override || leadTimezone, windowConfig)) {
                // Auto-delay to the next valid calling time
                originalScheduledAt = scheduledDate.toISOString();
                finalScheduledAt = getNextValidCallTime(
                    callingWindow.timezone_override || leadTimezone,
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
            console.error('Error creating scheduled call:', error);
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
        console.error('Error creating scheduled call:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
