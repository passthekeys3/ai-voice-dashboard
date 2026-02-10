import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { InviteClientUserDialog } from '@/components/dashboard/InviteClientUserDialog';
import { ClientPermissionsEditor } from '@/components/dashboard/ClientPermissionsEditor';
import { ClientBillingEditor } from '@/components/dashboard/ClientBillingEditor';
import { ClientUsageDashboard } from '@/components/dashboard/ClientUsageDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Profile, Client } from '@/types';
import { getClientPermissions } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Client Details' };

export default async function ClientDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (error || !client) {
        notFound();
    }

    // Check if agency has Stripe Connect set up
    const agencyHasConnect = !!(user.agency.stripe_connect_account_id && user.agency.stripe_connect_charges_enabled);

    // Get client stats
    const { count: agentsCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id);

    const { count: callsCount } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id);

    // Get users with access to this client
    const { data: clientUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Client Details"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/clients">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Users className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">{client.name}</h2>
                            <p className="text-muted-foreground">{client.email}</p>
                        </div>
                    </div>
                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                        {client.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="ml-auto">
                        <InviteClientUserDialog clientId={id} clientName={client.name} />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Agents
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agentsCount || 0}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Calls
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{callsCount || 0}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Users
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{clientUsers?.length || 0}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Users Section */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Users with Access</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {clientUsers && clientUsers.length > 0 ? (
                            <div className="space-y-3">
                                {(clientUsers as Profile[]).map((profile) => (
                                    <div
                                        key={profile.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <UserCircle className="h-8 w-8 text-slate-400" />
                                            <div>
                                                <p className="font-medium">{profile.full_name}</p>
                                                <p className="text-sm text-muted-foreground">{profile.email}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline">
                                            {profile.role === 'client_admin' ? 'Admin' : 'Member'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                <p className="text-muted-foreground">No users have access yet</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Invite users to give them access to this client&apos;s dashboard
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Permissions Section */}
                <ClientPermissionsEditor
                    permissions={getClientPermissions(client as Client, user.agency)}
                    agencyId={user.agency.id}
                    isAgencyDefault={false}
                    clientId={id}
                />

                {/* Billing Section */}
                <ClientBillingEditor
                    clientId={id}
                    billingType={(client as Client).billing_type}
                    billingAmountCents={(client as Client).billing_amount_cents}
                    stripeSubscriptionId={(client as Client).stripe_subscription_id}
                    stripeCustomerId={(client as Client).stripe_customer_id}
                    nextBillingDate={(client as Client).next_billing_date}
                    agencyHasConnect={agencyHasConnect}
                    aiCallAnalysis={(client as Client).ai_call_analysis}
                />

                {/* Usage Dashboard (only for per-minute billing) */}
                {(client as Client).billing_type === 'per_minute' && (
                    <ClientUsageDashboard clientId={id} />
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Client Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Created</p>
                                <p className="font-medium">
                                    {new Date(client.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            {client.stripe_customer_id && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Stripe Customer</p>
                                    <p className="font-mono text-sm">{client.stripe_customer_id}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Branding</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {client.branding && Object.keys(client.branding).length > 0 ? (
                                <pre className="text-sm bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-auto">
                                    {JSON.stringify(client.branding, null, 2)}
                                </pre>
                            ) : (
                                <p className="text-muted-foreground">
                                    No custom branding configured. Using agency defaults.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
