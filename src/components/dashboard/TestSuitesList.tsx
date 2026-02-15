'use client';

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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TestTube2, MoreHorizontal, Trash2, Bot, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { TestSuite, TestRun } from '@/types';

interface TestSuitesListProps {
    suites: (TestSuite & {
        test_cases?: { id: string }[];
        latest_run?: TestRun[];
    })[];
}

function getRunStatusBadge(run: TestRun) {
    if (run.status === 'running') {
        return <Badge variant="default">Running</Badge>;
    }
    if (run.status === 'completed') {
        const total = run.passed_cases + run.failed_cases + run.errored_cases;
        if (run.failed_cases === 0 && run.errored_cases === 0) {
            return (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {run.passed_cases}/{total} Passed
                </Badge>
            );
        }
        return (
            <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {run.failed_cases + run.errored_cases}/{total} Failed
            </Badge>
        );
    }
    if (run.status === 'failed') {
        return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">{run.status}</Badge>;
}

export function TestSuitesList({ suites }: TestSuitesListProps) {
    const router = useRouter();

    const handleDelete = async (suiteId: string) => {
        if (!confirm('Are you sure you want to delete this test suite? All test cases and run history will be lost.')) return;

        try {
            const res = await fetch(`/api/test-suites/${suiteId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to delete test suite');
            }
            toast.success('Test suite deleted');
            router.refresh();
        } catch (err) {
            console.error('Failed to delete suite:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to delete test suite');
        }
    };

    if (suites.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <TestTube2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <CardTitle className="mb-2 text-lg">No Test Suites Yet</CardTitle>
                    <CardDescription className="text-center max-w-md mb-6">
                        Create your first test suite to validate agent behavior before deployment.
                        AI will help you generate realistic test scenarios.
                    </CardDescription>
                    <Button asChild>
                        <Link href="/testing/new">Create Test Suite</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Test Suites</CardTitle>
                <CardDescription>
                    {suites.length} suite{suites.length !== 1 ? 's' : ''}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead className="text-center">Cases</TableHead>
                            <TableHead>Last Run</TableHead>
                            <TableHead className="text-center">Score</TableHead>
                            <TableHead className="w-[40px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {suites.map((suite) => {
                            const caseCount = suite.test_cases?.length || 0;
                            const latestRun = suite.latest_run?.[0];

                            return (
                                <TableRow
                                    key={suite.id}
                                    className="cursor-pointer"
                                    onClick={() => router.push(`/testing/${suite.id}`)}
                                >
                                    <TableCell className="font-medium">
                                        <div>
                                            <p>{suite.name}</p>
                                            {suite.description && (
                                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {suite.description}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm">{suite.agent?.name || 'Unknown'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {caseCount}
                                    </TableCell>
                                    <TableCell>
                                        {latestRun ? (
                                            getRunStatusBadge(latestRun)
                                        ) : (
                                            <span className="text-sm text-muted-foreground">Never run</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {latestRun?.avg_score != null ? (
                                            <span className={`text-sm font-medium ${
                                                latestRun.avg_score >= 80 ? 'text-green-600' :
                                                latestRun.avg_score >= 60 ? 'text-amber-600' :
                                                'text-red-600'
                                            }`}>
                                                {latestRun.avg_score}%
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Suite actions">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        handleDelete(suite.id);
                                                    }}
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
