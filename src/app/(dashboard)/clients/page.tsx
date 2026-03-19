import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { CreateClientDialog } from '@/components/dashboard/CreateClientDialog';
import { FilterableClientGrid } from '@/components/dashboard/FilterableClientGrid';

export const metadata: Metadata = { title: 'Clients' };

export default async function ClientsPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch clients with embedded agent providers + call counts for card summaries
    const { data: clients } = await supabase
        .from('clients')
        .select('id, name, email, is_active, created_at, agents(id, provider), calls(count)')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Clients"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
                actions={<CreateClientDialog />}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                <FilterableClientGrid clients={clients || []} />
            </div>
        </div>
    );
}
