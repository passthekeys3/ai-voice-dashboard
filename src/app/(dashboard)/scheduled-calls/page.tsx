import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { ScheduledCallsList } from '@/components/dashboard/ScheduledCallsList';
import { ScheduleCallButton } from '@/components/dashboard/ScheduleCallButton';

export const metadata: Metadata = { title: 'Scheduled Calls' };

export default async function ScheduledCallsPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch scheduled calls
    const { data: scheduledCalls } = await supabase
        .from('scheduled_calls')
        .select('*, agent:agents(name, external_id)')
        .eq('agency_id', user.agency.id)
        .order('scheduled_at', { ascending: true });

    // Fetch agents for the schedule form
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id)
        .order('name');

    // Separate upcoming and past calls
    const upcomingCalls = scheduledCalls?.filter(c =>
        c.status === 'pending' || c.status === 'in_progress'
    ) || [];
    const pastCalls = scheduledCalls?.filter(c =>
        c.status === 'completed' || c.status === 'failed' || c.status === 'cancelled'
    ) || [];

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Scheduled Calls"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Scheduled Calls</h2>
                        <p className="text-muted-foreground">
                            Schedule outbound calls for follow-ups and appointments
                        </p>
                    </div>
                    <ScheduleCallButton agents={agents || []} />
                </div>

                <ScheduledCallsList
                    upcomingCalls={upcomingCalls}
                    pastCalls={pastCalls}
                />
            </div>
        </div>
    );
}
