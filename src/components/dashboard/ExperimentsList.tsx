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

    const handleStatusChange = async (experimentId: string, newStatus: 'running' | 'paused') => {
        setUpdating(experimentId);
        try {
            await fetch(`/api/experiments/${experimentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            router.refresh();
        } catch (err) {
            console.error('Failed to update experiment:', err);
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (experimentId: string) => {
        if (!confirm('Are you sure you want to delete this experiment?')) return;

        try {
            await fetch(`/api/experiments/${experimentId}`, { method: 'DELETE' });
            router.refresh();
        } catch (err) {
            console.error('Failed to delete experiment:', err);
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
                                                    onClick={() => handleDelete(experiment.id)}
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
            </CardContent>
        </Card>
    );
}
