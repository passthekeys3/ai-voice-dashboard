import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Plus, Globe, ArrowRight } from 'lucide-react';
import type { Workflow } from '@/types';

const triggerLabels: Record<string, string> = {
    call_ended: 'Call Ended',
    call_started: 'Call Started',
    inbound_call_started: 'Inbound Started',
    inbound_call_ended: 'Inbound Ended',
};

interface ClientWorkflowsProps {
    workflows: Workflow[];
    clientId: string;
    clientAgentIds: string[];
}

export function ClientWorkflows({ workflows, clientId, clientAgentIds }: ClientWorkflowsProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Workflows
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/workflows/new?client_id=${clientId}`}>
                        <Plus className="mr-1 h-4 w-4" />
                        Create Workflow
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                {workflows.length > 0 ? (
                    <div className="space-y-3">
                        {workflows.map((workflow) => {
                            const isGlobal = !workflow.agent_id || !clientAgentIds.includes(workflow.agent_id);

                            return (
                                <Link
                                    key={workflow.id}
                                    href={`/workflows/${workflow.id}?client_id=${clientId}`}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Zap className={`h-4 w-4 shrink-0 ${workflow.is_active ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                        <div className="min-w-0">
                                            <p className="font-medium truncate group-hover:text-primary transition-colors">
                                                {workflow.name}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                    {triggerLabels[workflow.trigger] || workflow.trigger}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {workflow.agent?.name || 'All Agents'}
                                                </span>
                                                {isGlobal && (
                                                    <Badge variant="secondary" className="text-xs gap-1">
                                                        <Globe className="h-3 w-3" />
                                                        Global
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant={workflow.is_active ? 'default' : 'secondary'} className="text-xs">
                                            {workflow.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground mb-3">No workflows configured for this client</p>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/workflows/new?client_id=${clientId}`}>
                                <Plus className="mr-1 h-4 w-4" />
                                Create Workflow
                            </Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
