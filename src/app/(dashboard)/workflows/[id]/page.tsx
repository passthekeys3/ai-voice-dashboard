import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { WorkflowEditor } from '@/components/dashboard/WorkflowEditor';
import { WorkflowExecutionLog } from '@/components/dashboard/WorkflowExecutionLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidUuid } from '@/lib/validation';

export const metadata: Metadata = { title: 'Edit Workflow' };

export default async function EditWorkflowPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ client_id?: string }>;
}) {
    const { id } = await params;
    const { client_id: clientId } = await searchParams;
    if (!isValidUuid(id)) {
        notFound();
    }
    const user = await requireAgencyAdmin();
    const supabase = await createClient();

    // Fetch the workflow
    const { data: workflow, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (error || !workflow) {
        notFound();
    }

    // Fetch agents for the dropdown — scoped to client if client_id provided
    let agentsQuery = supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id);

    if (clientId) {
        agentsQuery = agentsQuery.eq('client_id', clientId);
    }

    const { data: agents } = await agentsQuery.order('name');

    return (
        <div className="flex flex-col h-full">
            <Header
                title={workflow.name}
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={clientId ? `/clients/${clientId}` : '/workflows'} aria-label="Go back">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{workflow.name}</h2>
                    </div>
                </div>

                <WorkflowEditor
                    workflow={workflow}
                    agents={agents || []}
                    clientId={clientId}
                />

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Executions</CardTitle>
                        <CardDescription>
                            Execution history for this workflow
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WorkflowExecutionLog workflowId={workflow.id} limit={20} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
