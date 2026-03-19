import type { Metadata } from 'next';

import { requireAuth } from '@/lib/auth';
import { Header } from '@/components/dashboard/Header';
import { ActiveCallsList } from '@/components/dashboard/ActiveCallsList';

export const metadata: Metadata = { title: 'Live Calls' };

export default async function LiveCallsPage() {
    const user = await requireAuth();

    return (
        <div className="flex flex-col h-full">
            <Header
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <h2 className="text-lg font-semibold">Live Calls</h2>
                {/* aria-live region for screen reader announcements */}
                <div aria-live="polite" aria-atomic="true">
                    <ActiveCallsList />
                </div>
            </div>
        </div>
    );
}
