import { requireAuth, isClientUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { BackgroundSync } from '@/components/dashboard/BackgroundSync';
import { getUserPermissions } from '@/lib/permissions';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default async function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireAuth();

    // Agency users should use the main dashboard
    if (!isClientUser(user)) {
        redirect('/');
    }

    const permissions = getUserPermissions(user);

    // Use client branding if set, fall back to agency branding
    const branding = user.client?.branding
        ? { ...user.agency.branding, ...user.client.branding }
        : user.agency.branding;

    const displayName = user.client?.branding?.company_name
        || user.client?.name
        || user.agency.name;

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar
                isAgencyAdmin={false}
                agencyName={displayName}
                branding={branding}
                permissions={permissions}
                basePath="/portal"
            />
            <main className="flex-1 overflow-auto pt-14 md:pt-0">
                <BackgroundSync />
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </main>
        </div>
    );
}
