import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { BackgroundSync } from '@/components/dashboard/BackgroundSync';
import { getUserPermissions } from '@/lib/permissions';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireAuth();
    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar
                isAgencyAdmin={isAdmin}
                agencyName={user.agency.name}
                branding={user.agency.branding}
                permissions={permissions}
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
