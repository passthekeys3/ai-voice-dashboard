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

    // Fetch all agencies for the assignment dropdown (include plan_type for sorting)
    const { data: agencies } = await supabase
        .from('agencies')
        .select('id, name, plan_type')
        .order('name');

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Platform Agents</h1>
            <PlatformAgentsTable agencies={agencies || []} />
        </div>
    );
}
