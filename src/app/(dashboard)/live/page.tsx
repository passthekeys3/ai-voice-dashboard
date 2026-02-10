import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { Header } from '@/components/dashboard/Header';
import { ActiveCallsList } from '@/components/dashboard/ActiveCallsList';

export const metadata: Metadata = { title: 'Live Calls' };

export default async function LiveCallsPage() {
    const user = await requireAgencyAdmin();

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Live Calls"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6 overflow-auto">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Live Call Monitoring</h2>
                    <p className="text-muted-foreground">
                        Monitor active calls in real-time
                    </p>
                </div>

                {/* aria-live region for screen reader announcements */}
                <div aria-live="polite" aria-atomic="true">
                    <ActiveCallsList />
                </div>
            </div>
        </div>
    );
}
