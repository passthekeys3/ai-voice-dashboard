import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { Header } from '@/components/dashboard/Header';
import { InsightsDashboard } from '@/components/dashboard/InsightsDashboard';

export const metadata: Metadata = { title: 'Insights' };

export default async function InsightsPage() {
    const user = await requireAgencyAdmin();

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Insights"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6 overflow-auto">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">AI Call Insights</h2>
                    <p className="text-muted-foreground">
                        Actionable analytics powered by AI
                    </p>
                </div>

                <InsightsDashboard />
            </div>
        </div>
    );
}
