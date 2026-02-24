import type { Metadata } from 'next';
import { requireAuth, isClientUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Header } from '@/components/dashboard/Header';
import { getUserPermissions } from '@/lib/permissions';
import { ClientIntegrationsEditor } from '@/components/dashboard/ClientIntegrationsEditor';

export const metadata: Metadata = { title: 'Integrations' };

export default async function PortalIntegrationsPage() {
    const user = await requireAuth();

    if (!isClientUser(user)) {
        redirect('/');
    }

    const permissions = getUserPermissions(user);
    if (!permissions.can_manage_integrations) {
        redirect('/portal');
    }

    const clientId = user.client?.id;
    if (!clientId) {
        redirect('/portal');
    }

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Integrations"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />
            <div className="flex-1 p-4 sm:p-6">
                <ClientIntegrationsEditor clientId={clientId} isPortal />
            </div>
        </div>
    );
}
