import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function WorkflowDetailLoading() {
    return (
        <div className="flex flex-col h-full">
            {/* Header bar */}
            <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
                <Skeleton className="h-5 w-28" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                {/* Back button + title */}
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div>
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-56 mt-1" />
                    </div>
                </div>

                {/* WorkflowEditor — multiple cards in space-y-6 max-w-3xl */}
                <div className="space-y-6 max-w-3xl">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-36" />
                            <Skeleton className="h-4 w-56" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Trigger */}
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-4 w-48" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-20" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                    </div>
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Skeleton className="h-10 w-24" />
                </div>

                {/* Recent Executions — Card with execution log table */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <div className="border-b px-4 py-3 flex gap-6">
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton key={i} className="h-4 w-20" />
                                ))}
                            </div>
                            <div className="divide-y">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="px-4 py-3 flex items-center gap-6">
                                        <Skeleton className="h-6 w-20 rounded-full" />
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
