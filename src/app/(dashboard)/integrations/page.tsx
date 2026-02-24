import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { IntegrationsPage } from '@/components/dashboard/IntegrationsPage';

export const metadata: Metadata = { title: 'Integrations' };

/** Mask a secret string for safe display: "...last4" or undefined */
function mask(value: string | undefined): string | undefined {
    return value ? '...' + value.slice(-4) : undefined;
}

export default async function IntegrationsRoute() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch agents for the default agent selector
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name, provider')
        .eq('agency_id', user.agency.id)
        .order('name');

    // Sanitize API config — mask the key before passing to client
    const rawApiConfig = user.agency.integrations?.api;
    const apiConfig = rawApiConfig ? {
        api_key: mask(rawApiConfig.api_key),
        enabled: rawApiConfig.enabled,
        default_agent_id: rawApiConfig.default_agent_id,
    } : undefined;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

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

                <IntegrationsPage
                    apiConfig={apiConfig}
                    agents={agents || []}
                    appUrl={appUrl}
                />
            </div>
        </div>
    );
}
