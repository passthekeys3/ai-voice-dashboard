import type { Metadata } from 'next';

import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { CallsPageClient } from '@/components/dashboard/CallsPageClient';
import { ExportCallsButton } from '@/components/dashboard/ExportCallsButton';
import { getUserPermissions } from '@/lib/permissions';
import type { Call } from '@/types';

export const metadata: Metadata = { title: 'Call History' };

export default async function ClientCallsPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const permissions = getUserPermissions(user);

    // Client users without a client_id should see no calls
    if (!user.client) {
        return (
            <div className="flex flex-col h-full">
                <Header
                    title="Call History"
                    userName={user.profile.full_name}
                    userEmail={user.email}
                    userAvatar={user.profile.avatar_url}
                />
                <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Call History</h2>
                        <p className="text-muted-foreground">No client account linked.</p>
                    </div>
                </div>
            </div>
        );
    }

    const query = supabase
        .from('calls')
        .select('*, agents!inner(name, provider, agency_id)')
        .eq('agents.agency_id', user.agency.id)
        .order('started_at', { ascending: false })
        .limit(25)
        .eq('client_id', user.client.id);

    const { data: calls } = await query;

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Call History"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
                actions={permissions.can_export_calls ? <ExportCallsButton /> : undefined}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">

                <CallsPageClient
                    initialCalls={(calls || []) as (Call & { agents: { name: string; provider: string } })[]}
                    showCosts={permissions.show_costs}
                    showTranscripts={permissions.show_transcripts}
                    allowPlayback={permissions.allow_playback}
                />
            </div>
        </div>
    );
}
