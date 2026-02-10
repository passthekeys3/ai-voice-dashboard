import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { PhoneNumbersList } from '@/components/dashboard/PhoneNumbersList';
import { BuyPhoneNumberButton } from '@/components/dashboard/BuyPhoneNumberButton';
import { SyncPhoneNumbersButton } from '@/components/dashboard/SyncPhoneNumbersButton';

export const metadata: Metadata = { title: 'Phone Numbers' };

export default async function PhoneNumbersPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

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

    // Fetch agents for assignment
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id)
        .order('name');

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Phone Numbers"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6 overflow-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Phone Numbers</h2>
                        <p className="text-muted-foreground">
                            Purchase and manage phone numbers for your AI agents
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <SyncPhoneNumbersButton />
                        <BuyPhoneNumberButton agents={agents || []} />
                    </div>
                </div>

                <PhoneNumbersList
                    phoneNumbers={phoneNumbers || []}
                    agents={agents || []}
                />
            </div>
        </div>
    );
}
