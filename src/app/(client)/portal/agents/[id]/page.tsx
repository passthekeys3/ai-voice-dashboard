import type { Metadata } from 'next';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getUserPermissions } from '@/lib/permissions';
import { Header } from '@/components/dashboard/Header';
import { AgentEditor } from '@/components/dashboard/AgentEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Agent Details' };

export default async function ClientAgentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await requireAuth();
    const supabase = await createClient();
    const permissions = getUserPermissions(user);
    const canEdit = permissions.can_edit_agents;

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
    if (agent.client_id !== user.client?.id) {
        notFound();
    }

    const providerStyles = {
        retell: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        vapi: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
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
                        <Link href="/portal/agents">
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
                        {agent.provider}
                    </Badge>
                </div>

                {canEdit ? (
                    <AgentEditor
                        agentId={agent.id}
                        provider={agent.provider as 'retell' | 'vapi' | 'bland'}
                        isActive={agent.is_active}
                        clientId={agent.client_id}
                        clients={[]}
                        config={agent.config || {}}
                        webhookUrl={agent.webhook_url}
                    />
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
