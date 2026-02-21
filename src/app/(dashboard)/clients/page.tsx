import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { CreateClientDialog } from '@/components/dashboard/CreateClientDialog';
import { FilterableClientGrid } from '@/components/dashboard/FilterableClientGrid';
import type { Client } from '@/types';

export const metadata: Metadata = { title: 'Clients' };

export default async function ClientsPage() {
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Only select fields needed by the UI — never send API keys to client components
    const { data: clients } = await supabase
        .from('clients')
        .select('id, name, email, is_active, created_at')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Clients"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
                        <p className="text-muted-foreground">
                            Manage your client sub-accounts
                        </p>
                    </div>
                    <CreateClientDialog />
                </div>

                <FilterableClientGrid clients={(clients || []) as Client[]} />
            </div>
        </div>
    );
}
