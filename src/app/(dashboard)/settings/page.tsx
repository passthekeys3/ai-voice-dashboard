import type { Metadata } from 'next';

import { Suspense } from 'react';
import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { SettingsForm } from '@/components/dashboard/SettingsForm';
import { ClientPermissionsEditor } from '@/components/dashboard/ClientPermissionsEditor';
import { BillingSection } from '@/components/dashboard/BillingSection';
import { StripeConnectSection } from '@/components/dashboard/StripeConnectSection';
import { CustomDomainSettings } from '@/components/dashboard/CustomDomainSettings';
import { DEFAULT_CLIENT_PERMISSIONS } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain } from 'lucide-react';

function BillingSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-10 w-40" />
            </CardContent>
        </Card>
    );
}

async function AIUsageCard({ agencyId }: { agencyId: string }) {
    const supabase = await createClient();
    const { data: agency } = await supabase
        .from('agencies')
        .select('ai_analysis_count')
        .eq('id', agencyId)
        .single();

    const count = (agency as { ai_analysis_count?: number } | null)?.ai_analysis_count ?? 0;
    const costDollars = (count * 0.01).toFixed(2);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    AI Call Analysis Usage
                </CardTitle>
                <CardDescription>
                    Tracked usage for AI-powered call analysis across all clients
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-4">
                    <div>
                        <p className="text-3xl font-bold">{count.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">calls analyzed</p>
                    </div>
                    <div className="text-xl font-semibold text-muted-foreground">=</div>
                    <div>
                        <p className="text-3xl font-bold">${costDollars}</p>
                        <p className="text-sm text-muted-foreground">at $0.01/call</p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    Enable or disable AI analysis per-client in each client&apos;s billing settings.
                </p>
            </CardContent>
        </Card>
    );
}

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
    const user = await requireAgencyAdmin();

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Settings"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                    <p className="text-muted-foreground">
                        Configure your agency branding, integrations, and billing
                    </p>
                </div>

                {/* Billing Section - Only for agency admins */}
                {user.profile.role === 'agency_admin' && (
                    <Suspense fallback={<BillingSkeleton />}>
                        <BillingSection />
                    </Suspense>
                )}

                {/* Stripe Connect — Agency bills their clients */}
                {user.profile.role === 'agency_admin' && (
                    <Suspense fallback={<BillingSkeleton />}>
                        <StripeConnectSection />
                    </Suspense>
                )}

                {/* AI Call Analysis Usage */}
                {user.profile.role === 'agency_admin' && (
                    <Suspense fallback={<BillingSkeleton />}>
                        <AIUsageCard agencyId={user.agency.id} />
                    </Suspense>
                )}

                <SettingsForm agency={user.agency} />

                {/* Custom Domain Settings - Only for agency admins */}
                {user.profile.role === 'agency_admin' && (
                    <CustomDomainSettings />
                )}

                <ClientPermissionsEditor
                    permissions={user.agency.default_client_permissions || DEFAULT_CLIENT_PERMISSIONS}
                    agencyId={user.agency.id}
                    isAgencyDefault={true}
                />
            </div>
        </div>
    );
}
