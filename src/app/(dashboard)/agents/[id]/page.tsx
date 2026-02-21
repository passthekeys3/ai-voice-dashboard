import type { Metadata } from 'next';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getUserPermissions } from '@/lib/permissions';
import { Header } from '@/components/dashboard/Header';
import { AgentEditor } from '@/components/dashboard/AgentEditor';
import { KnowledgeBaseEditor } from '@/components/dashboard/KnowledgeBaseEditor';
import { TestCall } from '@/components/dashboard/TestCall';
import { WidgetSettings } from '@/components/dashboard/WidgetSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, TestTube2, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Agent Details' };

export default async function AgentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await requireAuth();
    const supabase = await createClient();
    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);
    const canEdit = isAdmin || permissions.can_edit_agents;

    const { data: agent, error } = await supabase
        .from('agents')
        .select('*, clients(name)')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (error || !agent) {
        notFound();
    }

    // Client users can only view their agents
    if (!isAdmin && agent.client_id !== user.client?.id) {
        notFound();
    }

    // Get all clients for the dropdown (admin only)
    let clients: { id: string; name: string }[] = [];
    if (isAdmin) {
        const { data: clientList } = await supabase
            .from('clients')
            .select('id, name')
            .eq('agency_id', user.agency.id)
            .order('name');
        clients = clientList || [];
    }

    // Get latest test run for this agent
    const { data: latestTestRun } = await supabase
        .from('test_runs')
        .select('id, status, passed_cases, failed_cases, errored_cases, avg_score, total_cases, test_suite_id, created_at, test_suite:test_suites(name)')
        .eq('agent_id', id)
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    const providerStyles = {
        retell: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        vapi: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        bland: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    };

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Agent Details"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/agents">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Bot className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
                            <p className="text-muted-foreground">
                                {agent.clients?.name || 'Unassigned'}
                            </p>
                        </div>
                    </div>
                    <Badge className={providerStyles[agent.provider as keyof typeof providerStyles]}>
                        {agent.provider === 'bland' ? 'Bland.ai' : agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1)}
                    </Badge>
                </div>

                {/* Latest Test Run Card */}
                {isAdmin && latestTestRun && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TestTube2 className="h-4 w-4" />
                                Latest Test Run
                            </CardTitle>
                            <CardDescription>
                                {((latestTestRun.test_suite as unknown as { name: string }[] | null)?.[0]?.name) || 'Test Suite'} &mdash;{' '}
                                {new Date(latestTestRun.created_at).toLocaleDateString()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                {latestTestRun.status === 'completed' ? (
                                    latestTestRun.failed_cases === 0 && latestTestRun.errored_cases === 0 ? (
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle2 className="h-5 w-5" />
                                            <span className="font-medium">
                                                All {latestTestRun.passed_cases} tests passed
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-red-600">
                                            <XCircle className="h-5 w-5" />
                                            <span className="font-medium">
                                                {latestTestRun.failed_cases + latestTestRun.errored_cases} of {latestTestRun.total_cases} failed
                                            </span>
                                        </div>
                                    )
                                ) : (
                                    <Badge variant="secondary">{latestTestRun.status}</Badge>
                                )}
                                {latestTestRun.avg_score != null && (
                                    <Badge variant="outline">Score: {latestTestRun.avg_score}%</Badge>
                                )}
                                <Button variant="outline" size="sm" asChild className="ml-auto">
                                    <Link href={`/testing/${latestTestRun.test_suite_id}/runs/${latestTestRun.id}`}>
                                        View Results
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {canEdit ? (
                    <div className="space-y-6">
                        <AgentEditor
                            agentId={agent.id}
                            provider={agent.provider as 'retell' | 'vapi' | 'bland'}
                            isActive={agent.is_active}
                            clientId={agent.client_id}
                            clients={clients}
                            config={agent.config || {}}
                            webhookUrl={agent.webhook_url}
                        />

                        {isAdmin && agent.provider === 'retell' && (
                            <>
                                <TestCall
                                    agentId={agent.id}
                                    agentName={agent.name}
                                />
                                <KnowledgeBaseEditor
                                    agentId={agent.id}
                                />
                                <WidgetSettings
                                    agentId={agent.id}
                                    agentName={agent.name}
                                    widgetEnabled={agent.widget_enabled || false}
                                    widgetConfig={agent.widget_config || {}}
                                />
                            </>
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
                        <p className="text-muted-foreground">
                            You can view this agent but cannot edit its configuration.
                            Contact your agency administrator for changes.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}


