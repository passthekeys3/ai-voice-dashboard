import { requireAuth, isAgencyAdmin, isClientUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { BackgroundSync } from '@/components/dashboard/BackgroundSync';
import { getUserPermissions } from '@/lib/permissions';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Paths that are accessible without an active subscription
const UNGATED_PATHS = ['/billing', '/settings'];

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireAuth();

    // Client users should use the client portal
    if (isClientUser(user)) {
        redirect('/portal');
    }

    // Subscription gating — agency must have an active subscription
    const activeStatuses = ['active', 'trialing'];
    const hasActiveSub = activeStatuses.includes(user.agency.subscription_status || '');

    if (!hasActiveSub) {
        const headersList = await headers();
        const pathname = headersList.get('x-pathname') || '/';
        const isUngatedPath = UNGATED_PATHS.some(p => pathname.startsWith(p));

        if (!isUngatedPath) {
            redirect('/billing/upgrade');
        }
    }

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
