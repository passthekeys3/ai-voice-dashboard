'use client';

/**
 * Workflow Execution Log
 *
 * Displays workflow execution history in an expandable table.
 * Shows per-action results when a row is expanded.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    SkipForward,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import type { WorkflowExecutionLog as WorkflowExecutionLogType, ActionResult } from '@/types';

interface WorkflowExecutionLogProps {
    workflowId?: string;
    limit?: number;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string; label: string }> = {
    completed: { icon: CheckCircle, variant: 'default', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Completed' },
    partial_failure: { icon: AlertTriangle, variant: 'secondary', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Partial Failure' },
    failed: { icon: XCircle, variant: 'destructive', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Failed' },
    skipped: { icon: SkipForward, variant: 'outline', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', label: 'Skipped' },
    running: { icon: Clock, variant: 'secondary', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Running' },
};

const ACTION_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string }> = {
    success: { icon: CheckCircle, color: 'text-green-600' },
    failed: { icon: XCircle, color: 'text-red-600' },
    skipped: { icon: SkipForward, color: 'text-gray-400' },
};

function formatRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatDuration(ms: number | undefined): string {
    if (ms === undefined || ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function ActionResultRow({ result }: { result: ActionResult }) {
    const config = ACTION_STATUS_CONFIG[result.status] || ACTION_STATUS_CONFIG.skipped;
    const Icon = config.icon;

    return (
        <div className="flex items-center justify-between py-1.5 px-3 text-sm border-b last:border-b-0 border-muted/50">
            <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                <span className="font-mono text-xs text-muted-foreground">
                    #{result.action_index + 1}
                </span>
                <span className="text-xs">
                    {result.action_type.replace(/_/g, ' ')}
                </span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                    {formatDuration(result.duration_ms)}
                </span>
                {result.error && (
                    <span className="text-[10px] text-red-500 max-w-[200px] truncate">
                        {result.error}
                    </span>
                )}
            </div>
        </div>
    );
}

export function WorkflowExecutionLog({ workflowId, limit = 50 }: WorkflowExecutionLogProps) {
    const [executions, setExecutions] = useState<WorkflowExecutionLogType[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchExecutions = useCallback(async () => {
        setLoading(true);
        try {
            const url = workflowId
                ? `/api/workflows/${workflowId}/executions?limit=${limit}`
                : `/api/workflows/executions?limit=${limit}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();
            setExecutions(data.executions || []);
        } catch (err) {
            console.error('Failed to fetch executions:', err);
        } finally {
            setLoading(false);
        }
    }, [workflowId, limit]);

    useEffect(() => {
        fetchExecutions();
    }, [fetchExecutions]);

    const toggleExpand = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (executions.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No executions yet</p>
                <p className="text-xs mt-1">
                    Execution logs will appear here when workflows run
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-end mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchExecutions}
                    disabled={loading}
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Time</TableHead>
                        {!workflowId && <TableHead>Workflow</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Call ID</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {executions.map((exec) => {
                        const statusConfig = STATUS_CONFIG[exec.status] || STATUS_CONFIG.running;
                        const isExpanded = expandedId === exec.id;

                        return (
                            <TableRow
                                key={exec.id}
                                className="cursor-pointer group"
                                onClick={() => toggleExpand(exec.id)}
                            >
                                <TableCell className="w-8 pr-0">
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                    {formatRelativeTime(exec.created_at)}
                                </TableCell>
                                {!workflowId && (
                                    <TableCell className="text-sm font-medium">
                                        {exec.workflow?.name || 'Unknown'}
                                    </TableCell>
                                )}
                                <TableCell>
                                    <Badge className={statusConfig.color}>
                                        {statusConfig.label}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                    <span className={exec.actions_failed > 0 ? 'text-red-600' : 'text-green-600'}>
                                        {exec.actions_succeeded}/{exec.actions_total} succeeded
                                    </span>
                                </TableCell>
                                <TableCell className="text-xs font-mono">
                                    {formatDuration(exec.duration_ms)}
                                </TableCell>
                                <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                                    {exec.call_id ? exec.call_id.slice(0, 8) + '...' : '-'}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            {/* Expanded details rendered outside the table for proper layout */}
            {expandedId && (() => {
                const exec = executions.find((e) => e.id === expandedId);
                if (!exec) return null;

                return (
                    <div className="border rounded-md mx-4 mb-4 mt-1 bg-muted/30">
                        <div className="px-3 py-2 border-b bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">
                                Action Details
                            </span>
                            {exec.error_summary && (
                                <p className="text-[10px] text-red-500 mt-0.5">
                                    {exec.error_summary}
                                </p>
                            )}
                        </div>
                        {exec.action_results && exec.action_results.length > 0 ? (
                            exec.action_results.map((result, i) => (
                                <ActionResultRow key={i} result={result} />
                            ))
                        ) : (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                No action details available
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
