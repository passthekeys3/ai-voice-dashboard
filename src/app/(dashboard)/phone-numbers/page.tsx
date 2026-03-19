import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { PhoneNumbersPageClient } from '@/components/dashboard/PhoneNumbersPageClient';

export const metadata: Metadata = { title: 'Phone Numbers' };

export default async function PhoneNumbersPage() {
    const user = await requireAgencyAdmin();
    const supabase = createServiceClient();

    // Fetch phone numbers with inbound and outbound agent joins
    const { data: phoneNumbers } = await supabase
        .from('phone_numbers')
        .select(`
            *,
            inbound_agent:agents!phone_numbers_inbound_agent_id_fkey(id, name),
            outbound_agent:agents!phone_numbers_outbound_agent_id_fkey(id, name)
        `)
        .eq('agency_id', user.agency.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    // Fetch agents for assignment (include provider for filtering)
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name, provider')
        .eq('agency_id', user.agency.id)
        .order('name');

    // Determine which providers are configured (have API keys)
    const { data: agency } = await supabase
        .from('agencies')
        .select('retell_api_key, vapi_api_key, bland_api_key')
        .eq('id', user.agency.id)
        .single();

    const configuredProviders: string[] = [];
    if (agency?.retell_api_key) configuredProviders.push('retell');
    if (agency?.vapi_api_key) configuredProviders.push('vapi');
    if (agency?.bland_api_key) configuredProviders.push('bland');

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Phone Numbers"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <PhoneNumbersPageClient
                    initialPhoneNumbers={phoneNumbers || []}
                    agents={(agents || []).map(a => ({ id: a.id, name: a.name, provider: a.provider }))}
                    configuredProviders={configuredProviders}
                />
            </div>
        </div>
    );
}
