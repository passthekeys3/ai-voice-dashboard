'use client';

import { useState, useMemo, Fragment, memo, useCallback } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
    Play,
    ExternalLink,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    CheckCircle2,
    XCircle,
    Loader2,
    Clock,
    PhoneIncoming,
    PhoneOutgoing,
    ChevronDown,
    Phone,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Call } from '@/types';

interface CallsTableProps {
    calls: (Call & { agents?: { name: string; provider: string } })[];
    isLoading?: boolean;
    showCosts?: boolean;
    showTranscripts?: boolean;
    allowPlayback?: boolean;
}

type SortField = 'agent' | 'status' | 'direction' | 'duration' | 'cost' | 'time';
type SortDirection = 'asc' | 'desc';

const statusConfig: Record<string, {
    icon: React.ElementType;
    className: string;
    label: string;
}> = {
    completed: {
        icon: CheckCircle2,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 shadow-sm shadow-emerald-100 dark:shadow-emerald-900/20',
        label: 'Completed',
    },
    failed: {
        icon: XCircle,
        className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 shadow-sm shadow-red-100 dark:shadow-red-900/20',
        label: 'Failed',
    },
    in_progress: {
        icon: Loader2,
        className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 shadow-sm shadow-blue-100 dark:shadow-blue-900/20',
        label: 'In Progress',
    },
    queued: {
        icon: Clock,
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 shadow-sm shadow-amber-100 dark:shadow-amber-900/20',
        label: 'Queued',
    },
};

const SortableHeader = memo(function SortableHeader({
    children,
    field,
    currentSort,
    currentDirection,
    onSort,
    className,
}: {
    children: React.ReactNode;
    field: SortField;
    currentSort: SortField | null;
    currentDirection: SortDirection;
    onSort: (field: SortField) => void;
    className?: string;
}) {
    const isActive = currentSort === field;
    const ariaSortValue = isActive
        ? currentDirection === 'asc' ? 'ascending' : 'descending'
        : 'none';

    return (
        <TableHead
            className={cn('cursor-pointer select-none group', className)}
            aria-sort={ariaSortValue}
        >
            <button
                onClick={() => onSort(field)}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                aria-label={`Sort by ${field}, currently ${ariaSortValue}`}
            >
                {children}
                <span className={cn(
                    'inline-flex items-center justify-center rounded-sm transition-all duration-200',
                    isActive
                        ? 'bg-primary/10 text-primary p-0.5'
                        : 'opacity-0 group-hover:opacity-50'
                )}>
                    {isActive ? (
                        currentDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                        )
                    ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 transition-opacity" />
                    )}
                </span>
            </button>
        </TableHead>
    );
});

function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[30px]"></TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <Skeleton className="h-4 w-4" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-12" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-14" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
                <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No calls yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
                When your agents make or receive calls, they will appear here.
            </p>
        </div>
    );
}

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
    const config = statusConfig[status] || statusConfig.queued;
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                'gap-1.5 font-medium',
                config.className
            )}
        >
            <Icon className={cn(
                'h-3 w-3',
                status === 'in_progress' && 'animate-spin'
            )} />
            {config.label}
        </Badge>
    );
});

const DirectionBadge = memo(function DirectionBadge({ direction }: { direction: 'inbound' | 'outbound' }) {
    const isInbound = direction === 'inbound';
    const Icon = isInbound ? PhoneIncoming : PhoneOutgoing;

    return (
        <div className="flex items-center gap-1.5 text-sm">
            <Icon className={cn(
                'h-4 w-4',
                isInbound ? 'text-blue-500' : 'text-violet-500'
            )} />
            <span className="capitalize">{direction}</span>
        </div>
    );
});

function TranscriptPreview({ transcript }: { transcript?: string }) {
    if (!transcript) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <FileText className="h-4 w-4" />
                No transcript available
            </div>
        );
    }

    const preview = transcript.length > 300
        ? transcript.slice(0, 300) + '...'
        : transcript;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Transcript Preview
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {preview}
            </p>
        </div>
    );
}

// Mobile card view for smaller screens
const MobileCallCard = memo(function MobileCallCard({
    call,
    showCosts,
    allowPlayback,
    formatDuration,
    formatDateTime,
}: {
    call: Call & { agents?: { name: string; provider: string } };
    showCosts: boolean;
    allowPlayback: boolean;
    formatDuration: (seconds: number) => string;
    formatDateTime: (date: string) => { relative: string; absolute: string };
}) {
    const dateTime = formatDateTime(call.started_at);

    return (
        <div className="p-4 border-b last:border-b-0 space-y-3">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="font-medium">{call.agents?.name || 'Unknown Agent'}</div>
                    <div className="text-sm text-muted-foreground">{dateTime.relative}</div>
                </div>
                <StatusBadge status={call.status} />
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
                <DirectionBadge direction={call.direction} />
                <span className="font-mono">{formatDuration(call.duration_seconds)}</span>
                {showCosts && (
                    <span className="font-mono">${(call.cost_cents / 100).toFixed(2)}</span>
                )}
            </div>

            <div className="flex gap-2">
                {allowPlayback && call.audio_url && (
                    <Button variant="outline" size="sm" asChild>
                        <a
                            href={call.audio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Play audio"
                        >
                            <Play className="h-4 w-4 mr-1" />
                            Play
                        </a>
                    </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/calls/${call.id}`} aria-label="View call details">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Details
                    </Link>
                </Button>
            </div>
        </div>
    );
});

export function CallsTable({
    calls,
    isLoading = false,
    showCosts = true,
    showTranscripts = true,
    allowPlayback = true,
}: CallsTableProps) {
    const [sortField, setSortField] = useState<SortField | null>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const toggleRow = useCallback((callId: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(callId)) {
                next.delete(callId);
            } else {
                next.add(callId);
            }
            return next;
        });
    }, []);

    const handleRowKeyDown = useCallback((e: React.KeyboardEvent, callId: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleRow(callId);
        }
    }, [toggleRow]);

    const sortedCalls = useMemo(() => {
        if (!sortField) return calls;

        return [...calls].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'agent':
                    comparison = (a.agents?.name || '').localeCompare(b.agents?.name || '');
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                case 'direction':
                    comparison = a.direction.localeCompare(b.direction);
                    break;
                case 'duration':
                    comparison = a.duration_seconds - b.duration_seconds;
                    break;
                case 'cost':
                    comparison = a.cost_cents - b.cost_cents;
                    break;
                case 'time':
                    comparison = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [calls, sortField, sortDirection]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return {
            relative: formatDistanceToNow(date, { addSuffix: true }),
            absolute: format(date, 'MMM d, yyyy h:mm a'),
        };
    };

    if (isLoading) {
        return <TableSkeleton />;
    }

    if (calls.length === 0) {
        return (
            <div className="rounded-md border">
                <EmptyState />
            </div>
        );
    }

    return (
        <div className="rounded-md border overflow-hidden">
            {/* Mobile card view - visible on small screens */}
            <div className="md:hidden">
                {sortedCalls.map((call) => (
                    <MobileCallCard
                        key={call.id}
                        call={call}
                        showCosts={showCosts}
                        allowPlayback={allowPlayback}
                        formatDuration={formatDuration}
                        formatDateTime={formatDateTime}
                    />
                ))}
            </div>

            {/* Desktop table view - hidden on small screens */}
            <Table className="hidden md:table">
                <TableHeader>
                    <TableRow className="bg-muted/30">
                        <TableHead className="w-[30px]"></TableHead>
                        <SortableHeader
                            field="agent"
                            currentSort={sortField}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Agent
                        </SortableHeader>
                        <SortableHeader
                            field="status"
                            currentSort={sortField}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Status
                        </SortableHeader>
                        <SortableHeader
                            field="direction"
                            currentSort={sortField}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Direction
                        </SortableHeader>
                        <SortableHeader
                            field="duration"
                            currentSort={sortField}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Duration
                        </SortableHeader>
                        {showCosts && (
                            <SortableHeader
                                field="cost"
                                currentSort={sortField}
                                currentDirection={sortDirection}
                                onSort={handleSort}
                            >
                                Cost
                            </SortableHeader>
                        )}
                        <SortableHeader
                            field="time"
                            currentSort={sortField}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Time
                        </SortableHeader>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedCalls.map((call, index) => {
                        const isExpanded = expandedRows.has(call.id);
                        const dateTime = formatDateTime(call.started_at);

                        return (
                            <Fragment key={call.id}>
                                <TableRow
                                    className={cn(
                                        'group cursor-pointer transition-all duration-300',
                                        'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                                        isExpanded && 'bg-slate-50/80 dark:bg-slate-800/30',
                                        // Animate new rows (first 3 rows if sorted by time desc)
                                        sortField === 'time' &&
                                        sortDirection === 'desc' &&
                                        index < 3 &&
                                        'animate-in fade-in slide-in-from-top-2 duration-300'
                                    )}
                                    style={{
                                        animationDelay: sortField === 'time' && sortDirection === 'desc' && index < 3
                                            ? `${index * 50}ms`
                                            : undefined,
                                    }}
                                    tabIndex={0}
                                    role="button"
                                    aria-expanded={isExpanded}
                                    aria-label={`Call from ${call.agents?.name || 'Unknown'}, ${statusConfig[call.status]?.label || call.status}, ${formatDuration(call.duration_seconds)}`}
                                    onClick={() => toggleRow(call.id)}
                                    onKeyDown={(e) => handleRowKeyDown(e, call.id)}
                                >
                                    <TableCell className="w-[30px] pr-0">
                                        <span
                                            className="p-1 rounded"
                                            aria-hidden="true"
                                        >
                                            <ChevronDown className={cn(
                                                'h-4 w-4 text-muted-foreground transition-transform duration-300',
                                                isExpanded ? 'rotate-0' : '-rotate-90'
                                            )} />
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <span>{call.agents?.name || 'Unknown Agent'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={call.status} />
                                    </TableCell>
                                    <TableCell>
                                        <DirectionBadge direction={call.direction} />
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {formatDuration(call.duration_seconds)}
                                    </TableCell>
                                    {showCosts && (
                                        <TableCell className="font-mono text-sm">
                                            ${(call.cost_cents / 100).toFixed(2)}
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm">{dateTime.relative}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {dateTime.absolute}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div
                                            className="flex items-center justify-end gap-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {allowPlayback && call.audio_url && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    asChild
                                                    className="opacity-70 hover:opacity-100 transition-opacity"
                                                >
                                                    <a
                                                        href={call.audio_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label="Play audio"
                                                    >
                                                        <Play className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                                className="opacity-70 hover:opacity-100 transition-opacity"
                                            >
                                                <Link
                                                    href={`/calls/${call.id}`}
                                                    aria-label="View call details"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                        <TableCell colSpan={showCosts ? 8 : 7} className="p-0">
                                            <div className="px-6 py-4 border-l-2 border-primary/30 ml-4 animate-in fade-in slide-in-from-top-1 duration-300 ease-out">
                                                <div className={`grid grid-cols-1 ${showTranscripts ? 'md:grid-cols-2' : ''} gap-6`}>
                                                    {showTranscripts && (
                                                        <div className="space-y-4">
                                                            <TranscriptPreview transcript={call.transcript} />
                                                        </div>
                                                    )}
                                                    <div className="space-y-3">
                                                        {call.summary && (
                                                            <div>
                                                                <span className="text-sm font-medium">Summary</span>
                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                    {call.summary}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {call.from_number && (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <span className="text-muted-foreground">From:</span>
                                                                <span className="font-mono">{call.from_number}</span>
                                                            </div>
                                                        )}
                                                        {call.to_number && (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <span className="text-muted-foreground">To:</span>
                                                                <span className="font-mono">{call.to_number}</span>
                                                            </div>
                                                        )}
                                                        {call.sentiment && (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <span className="text-muted-foreground">Sentiment:</span>
                                                                <Badge variant="outline" className="capitalize">
                                                                    {call.sentiment}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                        {call.call_score != null && (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <span className="text-muted-foreground">Call Score:</span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={
                                                                        call.call_score >= 70 ? 'border-green-500 text-green-700 dark:text-green-400'
                                                                        : call.call_score >= 40 ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                                                                        : 'border-red-500 text-red-700 dark:text-red-400'
                                                                    }
                                                                >
                                                                    {call.call_score}/100
                                                                </Badge>
                                                            </div>
                                                        )}
                                                        <div className="pt-2">
                                                            <Button size="sm" asChild>
                                                                <Link href={`/calls/${call.id}`}>
                                                                    View Full Details
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
