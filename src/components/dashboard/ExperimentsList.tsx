'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    FlaskConical,
    Play,
    Pause,
    Trophy,
    MoreHorizontal,
    Trash2,
    Edit,
    BarChart3,
    Bot,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/lib/toast';
import type { Experiment } from '@/types';

interface ExperimentsListProps {
    experiments: (Experiment & { variants?: { id: string }[] })[];
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    running: { label: 'Running', variant: 'default' },
    paused: { label: 'Paused', variant: 'outline' },
    completed: { label: 'Completed', variant: 'secondary' },
};

const goalLabels: Record<string, string> = {
    conversion: 'Conversion Rate',
    duration: 'Call Duration',
    sentiment: 'Sentiment Score',
};

export function ExperimentsList({ experiments }: ExperimentsListProps) {
    const router = useRouter();
    const [updating, setUpdating] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleStatusChange = async (experimentId: string, newStatus: 'running' | 'paused') => {
        setUpdating(experimentId);
        try {
            const response = await fetch(`/api/experiments/${experimentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!response.ok) throw new Error('Failed to update');
            toast.success(newStatus === 'running' ? 'Experiment started' : 'Experiment paused');
            router.refresh();
        } catch (err) {
            console.error('Failed to update experiment:', err);
            toast.error('Failed to update experiment');
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (experimentId: string) => {
        try {
            const response = await fetch(`/api/experiments/${experimentId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            toast.success('Experiment deleted');
            router.refresh();
        } catch (err) {
            console.error('Failed to delete experiment:', err);
            toast.error('Failed to delete experiment');
        }
    };

    if (experiments.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No experiments yet</h3>
                    <p className="text-muted-foreground text-center mb-4 max-w-md">
                        Create A/B experiments to test different prompts and optimize
                        your agents for conversion, call duration, or sentiment.
                    </p>
                    <Button asChild>
                        <Link href="/experiments/new">Create Your First Experiment</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>All Experiments</CardTitle>
                <CardDescription>
                    {experiments.length} experiment{experiments.length !== 1 ? 's' : ''}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Mobile card layout */}
                <div className="md:hidden space-y-3">
                    {experiments.map((experiment) => {
                        const status = statusConfig[experiment.status] || statusConfig.draft;
                        return (
                            <div
                                key={experiment.id}
                                className="border rounded-lg p-4 space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <Link
                                            href={`/experiments/${experiment.id}`}
                                            className="font-medium hover:underline"
                                        >
                                            {experiment.name}
                                        </Link>
                                        {experiment.description && (
                                            <p className="text-sm text-muted-foreground truncate">
                                                {experiment.description}
                                            </p>
                                        )}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="shrink-0"
                                                disabled={updating === experiment.id}
                                                aria-label="Experiment actions"
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/experiments/${experiment.id}`}>
                                                    <BarChart3 className="h-4 w-4 mr-2" />
                                                    View Results
                                                </Link>
                                            </DropdownMenuItem>
                                            {experiment.status !== 'completed' && (
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/experiments/${experiment.id}/edit`}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            {experiment.status === 'running' ? (
                                                <DropdownMenuItem
                                                    onClick={() => handleStatusChange(experiment.id, 'paused')}
                                                >
                                                    <Pause className="h-4 w-4 mr-2" />
                                                    Pause
                                                </DropdownMenuItem>
                                            ) : experiment.status !== 'completed' && (
                                                <DropdownMenuItem
                                                    onClick={() => handleStatusChange(experiment.id, 'running')}
                                                >
                                                    <Play className="h-4 w-4 mr-2" />
                                                    Start
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                onClick={() => setDeleteConfirmId(experiment.id)}
                                                className="text-red-600"
                                                disabled={experiment.status === 'running'}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <Bot className="h-3.5 w-3.5" />
                                        <span>{experiment.agent?.name || 'Unknown'}</span>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {experiment.variants?.length || 0} variants
                                    </Badge>
                                    <span className="text-muted-foreground">
                                        {goalLabels[experiment.goal] || experiment.goal}
                                    </span>
                                    <Badge variant={status.variant} className="text-xs">
                                        {experiment.winner_variant_id && (
                                            <Trophy className="h-3 w-3 mr-1" />
                                        )}
                                        {status.label}
                                    </Badge>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop table layout */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead>Variants</TableHead>
                                <TableHead>Goal</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {experiments.map((experiment) => {
                                const status = statusConfig[experiment.status] || statusConfig.draft;
                                return (
                                    <TableRow key={experiment.id}>
                                        <TableCell>
                                            <div>
                                                <Link
                                                    href={`/experiments/${experiment.id}`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {experiment.name}
                                                </Link>
                                                {experiment.description && (
                                                    <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                        {experiment.description}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Bot className="h-4 w-4 text-muted-foreground" />
                                                <span>{experiment.agent?.name || 'Unknown'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {experiment.variants?.length || 0} variants
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {goalLabels[experiment.goal] || experiment.goal}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={status.variant}>
                                                {experiment.winner_variant_id && (
                                                    <Trophy className="h-3 w-3 mr-1" />
                                                )}
                                                {status.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={updating === experiment.id}
                                                        aria-label="Experiment actions"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/experiments/${experiment.id}`}>
                                                            <BarChart3 className="h-4 w-4 mr-2" />
                                                            View Results
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {experiment.status !== 'completed' && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/experiments/${experiment.id}/edit`}>
                                                                <Edit className="h-4 w-4 mr-2" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    {experiment.status === 'running' ? (
                                                        <DropdownMenuItem
                                                            onClick={() => handleStatusChange(experiment.id, 'paused')}
                                                        >
                                                            <Pause className="h-4 w-4 mr-2" />
                                                            Pause
                                                        </DropdownMenuItem>
                                                    ) : experiment.status !== 'completed' && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleStatusChange(experiment.id, 'running')}
                                                        >
                                                            <Play className="h-4 w-4 mr-2" />
                                                            Start
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        onClick={() => setDeleteConfirmId(experiment.id)}
                                                        className="text-red-600"
                                                        disabled={experiment.status === 'running'}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open: boolean) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete experiment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this experiment, all its variants, and associated data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (deleteConfirmId) {
                                    handleDelete(deleteConfirmId);
                                    setDeleteConfirmId(null);
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
