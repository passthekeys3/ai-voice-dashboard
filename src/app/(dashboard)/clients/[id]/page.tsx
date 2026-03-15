import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { InviteClientUserDialog } from '@/components/dashboard/InviteClientUserDialog';
import { ClientPermissionsEditor } from '@/components/dashboard/ClientPermissionsEditor';
import { ClientApiKeysEditor } from '@/components/dashboard/ClientApiKeysEditor';
import { ClientIntegrationsEditor } from '@/components/dashboard/ClientIntegrationsEditor';
import { ClientBillingEditor } from '@/components/dashboard/ClientBillingEditor';
import { ClientUsageDashboard } from '@/components/dashboard/ClientUsageDashboard';
import { ClientUsersList, DeleteClientButton } from '@/components/dashboard/ClientUsersList';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { CallsTable } from '@/components/dashboard/CallsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Bot, Phone, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTierFromPriceId } from '@/lib/billing/tiers';
import { TierGate } from '@/components/ui/tier-gate';
import { isValidUuid } from '@/lib/validation';
import type { Profile, Client, Agent, Call } from '@/types';
import { getClientPermissions } from '@/lib/permissions';
import { maskClientApiKeys } from '@/lib/clients/mask-keys';

export const metadata: Metadata = { title: 'Client Details' };

export default async function ClientDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    if (!isValidUuid(id)) {
        notFound();
    }
    const user = await requireAgencyAdmin();
    const tierInfo = getTierFromPriceId(user.agency.subscription_price_id || '');
    const currentTier = tierInfo?.tier ?? null;
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

    // Mask API keys for safe display (decrypts enc: prefix first)
    const safeClient = maskClientApiKeys(client);

    // Check if agency has Stripe Connect set up
    const agencyHasConnect = !!(user.agency.stripe_connect_account_id && user.agency.stripe_connect_charges_enabled);

    // Fetch assigned agents (full data for AgentCard)
    const { data: agents } = await supabase
        .from('agents')
        .select('*, clients(name)')
        .eq('client_id', id)
        .eq('agency_id', user.agency.id)
        .order('name');

    // Fetch phone numbers for agent cards
    const agentIds = (agents || []).map(a => a.id);
    const agentPhoneMap: Record<string, string> = {};
    if (agentIds.length > 0) {
        const { data: phoneNumbers } = await supabase
            .from('phone_numbers')
            .select('phone_number, agent_id')
            .eq('agency_id', user.agency.id)
            .eq('status', 'active')
            .in('agent_id', agentIds);
        phoneNumbers?.forEach(pn => {
            if (pn.agent_id) agentPhoneMap[pn.agent_id] = pn.phone_number;
        });
    }

    // Fetch recent calls + total count (one query, two uses)
    const { data: recentCalls, count: callsCount } = await supabase
        .from('calls')
        .select('*, agents!inner(name, provider, agency_id)', { count: 'exact' })
        .eq('client_id', id)
        .eq('agents.agency_id', user.agency.id)
        .order('started_at', { ascending: false })
        .limit(10);

    // Get users with access to this client
    const { data: clientUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('client_id', id)
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    const agentsCount = agents?.length || 0;

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Client Details"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/clients" aria-label="Back to clients">
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

                {/* Assigned Agents */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="h-5 w-5" />
                            Assigned Agents
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/agents">
                                Manage Agents <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {agents && agents.length > 0 ? (
                            <>
                                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {(agents as (Agent & { clients?: { name: string } | null })[]).slice(0, 6).map((agent) => (
                                        <AgentCard
                                            key={agent.id}
                                            agent={agent}
                                            phoneNumber={agentPhoneMap[agent.id]}
                                            showDelete={false}
                                        />
                                    ))}
                                </div>
                                {agents.length > 6 && (
                                    <div className="mt-4 text-center">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href="/agents">
                                                View all {agents.length} agents &rarr;
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-6">
                                <Bot className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-muted-foreground">No agents assigned to this client</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Calls */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Phone className="h-5 w-5" />
                            Recent Calls
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/calls">
                                View All Calls <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <CallsTable
                            calls={(recentCalls || []) as (Call & { agents: { name: string; provider: string } })[]}
                            showCosts={true}
                            showTranscripts={false}
                            allowPlayback={true}
                        />
                    </CardContent>
                </Card>

                {/* Users Section */}
                <ClientUsersList
                    clientId={id}
                    clientName={client.name}
                    users={(clientUsers || []) as Profile[]}
                />

                {/* Permissions Section */}
                <ClientPermissionsEditor
                    permissions={getClientPermissions(client as Client, user.agency)}
                    agencyId={user.agency.id}
                    isAgencyDefault={false}
                    clientId={id}
                />

                {/* Voice Provider API Keys */}
                <ClientApiKeysEditor
                    clientId={id}
                    retellApiKey={(safeClient as Client).retell_api_key || null}
                    vapiApiKey={(safeClient as Client).vapi_api_key || null}
                    blandApiKey={(safeClient as Client).bland_api_key || null}
                />

                {/* Integrations Section */}
                <TierGate currentTier={currentTier} requiredFeature="crm_integrations" label="Client Integrations">
                    <ClientIntegrationsEditor clientId={id} />
                </TierGate>

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

                {/* Danger Zone */}
                <DeleteClientButton
                    clientId={id}
                    clientName={client.name}
                    userCount={clientUsers?.length || 0}
                />
            </div>
        </div>
    );
}
