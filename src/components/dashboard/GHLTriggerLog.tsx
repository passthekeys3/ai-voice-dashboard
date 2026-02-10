'use client';

/**
 * GHL Trigger Activity Log
 *
 * Displays recent GHL webhook trigger events with status,
 * timezone info, and links to resulting calls.
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import type { GHLTriggerLog as GHLTriggerLogType } from '@/types';

interface GHLTriggerLogProps {
    logs: GHLTriggerLogType[];
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    initiated: { icon: CheckCircle, color: 'text-green-600', label: 'Initiated' },
    scheduled: { icon: Clock, color: 'text-blue-600', label: 'Scheduled' },
    failed: { icon: XCircle, color: 'text-red-600', label: 'Failed' },
    received: { icon: ArrowRight, color: 'text-yellow-600', label: 'Received' },
};

function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

export function GHLTriggerLog({ logs }: GHLTriggerLogProps) {
    if (logs.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No trigger events yet</p>
                <p className="text-xs mt-1">Events will appear here when GHL workflows trigger outbound calls</p>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Agent</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {logs.map((log) => {
                    const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.received;
                    const Icon = config.icon;

                    return (
                        <TableRow key={log.id}>
                            <TableCell className="text-xs">
                                {formatDateTime(log.created_at)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                                {log.phone_number}
                            </TableCell>
                            <TableCell className="text-sm">
                                {log.contact_name || '-'}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1.5">
                                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                                    <Badge variant={log.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                                        {config.label}
                                    </Badge>
                                    {log.timezone_delayed && (
                                        <Badge variant="outline" className="text-[10px]">
                                            TZ delayed
                                        </Badge>
                                    )}
                                </div>
                                {log.error_message && (
                                    <p className="text-[10px] text-red-500 mt-0.5 max-w-48 truncate">
                                        {log.error_message}
                                    </p>
                                )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {log.lead_timezone || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                                {log.agent?.name || '-'}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
