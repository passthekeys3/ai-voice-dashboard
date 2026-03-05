import { requireAuth, isAgencyAdmin, isClientUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { BackgroundSync } from '@/components/dashboard/BackgroundSync';
import { getUserPermissions } from '@/lib/permissions';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FeedbackWidget } from '@/components/dashboard/FeedbackWidget';
import { ImpersonationBanner } from '@/components/dashboard/ImpersonationBanner';
import { isPlatformAdmin } from '@/lib/admin';

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

    const isImpersonating = user.isImpersonating === true;

    // Subscription gating — skip during impersonation (admin needs full access)
    if (!isImpersonating) {
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
    }

    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);
    const showAdminNav = isPlatformAdmin(user.email);

    return (
        <ErrorBoundary>
            {isImpersonating && <ImpersonationBanner agencyName={user.agency.name} />}
            <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 ${isImpersonating ? 'pt-10' : ''}`}>
                <Sidebar
                    isAgencyAdmin={isAdmin}
                    agencyName={user.agency.name}
                    branding={user.agency.branding}
                    permissions={permissions}
                    isPlatformAdmin={showAdminNav}
                    isImpersonating={isImpersonating}
                />
                <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black dark:focus:bg-slate-900 dark:focus:text-white rounded-md">
                    Skip to main content
                </a>
                <main id="main-content" className={`flex-1 overflow-auto md:pt-0 ${isImpersonating ? 'pt-24' : 'pt-14'}`}>
                    <BackgroundSync />
                    {children}
                </main>
                <FeedbackWidget />
            </div>
        </ErrorBoundary>
    );
}
