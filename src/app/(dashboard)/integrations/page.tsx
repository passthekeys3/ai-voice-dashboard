import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { Header } from '@/components/dashboard/Header';
import { IntegrationsPage } from '@/components/dashboard/IntegrationsPage';

export const metadata: Metadata = { title: 'Integrations' };

export default async function IntegrationsRoute() {
    const user = await requireAgencyAdmin();

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Integrations"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
                    <p className="text-muted-foreground">
                        Connect your CRM, calendar, and messaging tools to automate workflows
                    </p>
                </div>

                <IntegrationsPage />
            </div>
        </div>
    );
}
