import type { Metadata } from 'next';

import { requireAgencyAdmin } from '@/lib/auth';
import { Header } from '@/components/dashboard/Header';
import { WorkflowExecutionLog } from '@/components/dashboard/WorkflowExecutionLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Workflow History' };

export default async function WorkflowHistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ workflow_id?: string }>;
}) {
    const user = await requireAgencyAdmin();
    const { workflow_id } = await searchParams;

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Workflow History"
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
                        <h2 className="text-2xl font-bold tracking-tight">Execution History</h2>
                        <p className="text-muted-foreground">
                            View workflow execution results
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {workflow_id ? 'Workflow Executions' : 'All Executions'}
                        </CardTitle>
                        <CardDescription>
                            {workflow_id
                                ? 'Execution history for this workflow'
                                : 'Recent workflow execution logs across all workflows'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WorkflowExecutionLog workflowId={workflow_id} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
