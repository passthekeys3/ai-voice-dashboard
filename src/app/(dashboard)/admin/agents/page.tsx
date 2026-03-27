import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/server';
import { PlatformAgentsTable } from '@/components/admin/PlatformAgentsTable';

export const metadata = {
    title: 'Platform Agents | Admin',
};

export default async function AdminAgentsPage() {
    const user = await requireAuth();

    if (!isPlatformAdmin(user.email)) {
        redirect('/');
    }

    const supabase = createServiceClient();

    // Fetch all agencies for the assignment dropdown
    const { data: agencies } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Platform Agents</h1>
                <p className="text-muted-foreground">
                    Manage agents on the platform Retell account and assign them to agencies.
                </p>
            </div>
            <PlatformAgentsTable agencies={agencies || []} />
        </div>
    );
}
