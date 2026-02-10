import type { Metadata } from 'next';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Header } from '@/components/dashboard/Header';
import { AgentBuilder } from '@/components/dashboard/AgentBuilder';

export const metadata: Metadata = { title: 'Agent Builder' };

export default async function AgentBuilderPage() {
    const user = await requireAuth();

    // Only agency admins can access the builder
    if (!isAgencyAdmin(user)) {
        redirect('/agents');
    }

    const supabase = await createClient();

    // Load data needed for the builder
    const [clientsResult, phoneNumbersResult] = await Promise.all([
        supabase
            .from('clients')
            .select('id, name')
            .eq('agency_id', user.agency.id)
            .order('name'),
        supabase
            .from('phone_numbers')
            .select('id, phone_number, nickname, agent_id')
            .eq('agency_id', user.agency.id)
            .eq('status', 'active')
            .is('agent_id', null), // Only unassigned numbers
    ]);

    const context = {
        hasGHL: !!user.agency.integrations?.ghl?.enabled,
        hasHubSpot: !!user.agency.integrations?.hubspot?.enabled,
        hasGCal: !!user.agency.integrations?.google_calendar?.enabled,
        hasCalendly: !!user.agency.integrations?.calendly?.enabled,
        hasSlack: !!user.agency.integrations?.slack?.enabled,
    };

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Agent Builder"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <AgentBuilder
                clients={clientsResult.data || []}
                phoneNumbers={phoneNumbersResult.data || []}
                context={context}
            />
        </div>
    );
}
