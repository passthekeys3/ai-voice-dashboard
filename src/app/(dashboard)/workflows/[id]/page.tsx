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

export const metadata: Metadata = { title: 'Edit Workflow' };

export default async function EditWorkflowPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
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

    // Fetch agents for the dropdown
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id)
        .order('name');

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Edit Workflow"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-6 space-y-6 overflow-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/workflows">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Edit Workflow</h2>
                        <p className="text-muted-foreground">
                            Modify your workflow configuration
                        </p>
                    </div>
                </div>

                <WorkflowEditor
                    workflow={workflow}
                    agents={agents || []}
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
