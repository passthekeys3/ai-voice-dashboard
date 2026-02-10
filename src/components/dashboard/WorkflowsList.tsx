'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Zap,
    Webhook,
    Trash2,
    Edit,
    MoreHorizontal,
    Bot,
    Globe,
    Copy,
    History,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workflow } from '@/types';

interface WorkflowsListProps {
    workflows: Workflow[];
}

const actionTypeIcons: Record<string, React.ReactNode> = {
    webhook: <Webhook className="h-4 w-4" />,
    // GHL
    ghl_log_call: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_create_contact: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_upsert_contact: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_add_tags: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_add_call_note: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_update_pipeline: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_lead_score: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_book_appointment: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_cancel_appointment: <span className="text-xs font-bold text-red-600">GHL</span>,
    ghl_trigger_workflow: <span className="text-xs font-bold text-green-600">GHL</span>,
    ghl_update_contact_field: <span className="text-xs font-bold text-green-600">GHL</span>,
    // HubSpot
    hubspot_log_call: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_create_contact: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_update_contact: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_upsert_contact: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_add_tags: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_add_call_note: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_update_pipeline: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_lead_score: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_book_appointment: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_cancel_appointment: <span className="text-xs font-bold text-red-600">HS</span>,
    hubspot_trigger_workflow: <span className="text-xs font-bold text-orange-600">HS</span>,
    hubspot_update_contact_field: <span className="text-xs font-bold text-orange-600">HS</span>,
    // Other
    email: <span className="text-xs">✉️</span>,
    slack: <span className="text-xs">💬</span>,
};

const actionTypeLabels: Record<string, string> = {
    webhook: 'Webhook',
    // GHL
    ghl_log_call: 'Log to GHL',
    ghl_create_contact: 'Create GHL Contact',
    ghl_upsert_contact: 'Upsert GHL Contact',
    ghl_add_tags: 'Auto-Tag (GHL)',
    ghl_add_call_note: 'Call Note (GHL)',
    ghl_update_pipeline: 'Pipeline (GHL)',
    ghl_lead_score: 'Lead Score (GHL)',
    ghl_book_appointment: 'Book Appt (GHL)',
    ghl_cancel_appointment: 'Cancel Appt (GHL)',
    ghl_trigger_workflow: 'Trigger Workflow (GHL)',
    ghl_update_contact_field: 'Update Field (GHL)',
    // HubSpot
    hubspot_log_call: 'Log to HubSpot',
    hubspot_create_contact: 'Create HS Contact',
    hubspot_update_contact: 'Update HS Contact',
    hubspot_upsert_contact: 'Upsert HS Contact',
    hubspot_add_tags: 'Auto-Tag (HS)',
    hubspot_add_call_note: 'Call Note (HS)',
    hubspot_update_pipeline: 'Pipeline (HS)',
    hubspot_lead_score: 'Lead Score (HS)',
    hubspot_book_appointment: 'Book Appt (HS)',
    hubspot_cancel_appointment: 'Cancel Appt (HS)',
    hubspot_trigger_workflow: 'Trigger Workflow (HS)',
    hubspot_update_contact_field: 'Update Field (HS)',
    // Other
    email: 'Send Email',
    slack: 'Slack Message',
};

const triggerLabels: Record<string, string> = {
    call_ended: 'Call Ended',
    call_started: 'Call Started',
    inbound_call_started: 'Inbound Started',
    inbound_call_ended: 'Inbound Ended',
};

export function WorkflowsList({ workflows }: WorkflowsListProps) {
    const router = useRouter();
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const handleToggleActive = async (workflowId: string, isActive: boolean) => {
        setUpdatingId(workflowId);
        try {
            await fetch(`/api/workflows/${workflowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: isActive }),
            });
            router.refresh();
        } catch (err) {
            console.error('Failed to update workflow:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = async (workflowId: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;

        try {
            await fetch(`/api/workflows/${workflowId}`, { method: 'DELETE' });
            router.refresh();
        } catch (err) {
            console.error('Failed to delete workflow:', err);
        }
    };

    const handleDuplicate = async (workflow: Workflow) => {
        try {
            const response = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${workflow.name} (copy)`,
                    description: workflow.description,
                    trigger: workflow.trigger,
                    agent_id: workflow.agent_id,
                    conditions: workflow.conditions,
                    actions: workflow.actions,
                    is_active: false,
                }),
            });
            if (response.ok) {
                router.refresh();
            }
        } catch (err) {
            console.error('Failed to duplicate workflow:', err);
        }
    };

    if (workflows.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
                    <p className="text-muted-foreground text-center mb-4 max-w-md">
                        Create automated workflows to send webhooks, log calls to your CRM,
                        or trigger other actions after each call.
                    </p>
                    <Button asChild>
                        <Link href="/workflows/new">Create Your First Workflow</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Active Workflows</CardTitle>
                <CardDescription>
                    {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} configured
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                    {workflows.map((workflow) => (
                        <div key={workflow.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{workflow.name}</div>
                                    {workflow.description && (
                                        <div className="text-sm text-muted-foreground truncate">
                                            {workflow.description}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Switch
                                        checked={workflow.is_active}
                                        disabled={updatingId === workflow.id}
                                        onCheckedChange={(checked) => handleToggleActive(workflow.id, checked)}
                                    />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon-sm">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/workflows/${workflow.id}`}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDuplicate(workflow)}>
                                                <Copy className="h-4 w-4 mr-2" />
                                                Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/workflows/history?workflow_id=${workflow.id}`}>
                                                    <History className="h-4 w-4 mr-2" />
                                                    History
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(workflow.id)} className="text-red-600">
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                    {triggerLabels[workflow.trigger] || workflow.trigger}
                                </Badge>
                                {workflow.agent ? (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Bot className="h-3.5 w-3.5" />
                                        {workflow.agent.name}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Globe className="h-3.5 w-3.5" />
                                        All Agents
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {workflow.actions.map((action, i) => (
                                    <Badge key={i} variant="secondary" className="flex items-center gap-1 text-xs">
                                        {actionTypeIcons[action.type]}
                                        {actionTypeLabels[action.type]}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Trigger</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead>Actions</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Options</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workflows.map((workflow) => (
                                <TableRow key={workflow.id}>
                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{workflow.name}</div>
                                            {workflow.description && (
                                                <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                    {workflow.description}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {triggerLabels[workflow.trigger] || workflow.trigger}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {workflow.agent ? (
                                            <div className="flex items-center gap-2">
                                                <Bot className="h-4 w-4 text-muted-foreground" />
                                                <span>{workflow.agent.name}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Globe className="h-4 w-4" />
                                                <span>All Agents</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {workflow.actions.map((action, i) => (
                                                <Badge
                                                    key={i}
                                                    variant="secondary"
                                                    className="flex items-center gap-1"
                                                >
                                                    {actionTypeIcons[action.type]}
                                                    {actionTypeLabels[action.type]}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={workflow.is_active}
                                            disabled={updatingId === workflow.id}
                                            onCheckedChange={(checked) => handleToggleActive(workflow.id, checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/workflows/${workflow.id}`}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDuplicate(workflow)}
                                                >
                                                    <Copy className="h-4 w-4 mr-2" />
                                                    Duplicate
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/workflows/history?workflow_id=${workflow.id}`}>
                                                        <History className="h-4 w-4 mr-2" />
                                                        History
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(workflow.id)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
