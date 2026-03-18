import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AgentDetailLoading() {
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
                {/* Back button + icon + name + badge row */}
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <div>
                            <Skeleton className="h-8 w-44" />
                            <Skeleton className="h-4 w-24 mt-1" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>

                {/* Latest Test Run Card */}
                <Card>
                    <CardHeader className="pb-3">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <Skeleton className="h-9 w-28 rounded-md ml-auto" />
                        </div>
                    </CardContent>
                </Card>

                {/* AgentEditor — Card with form fields */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-6 w-11 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>

                {/* TestCall — Card with call controls */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-full max-w-xs" />
                            <Skeleton className="h-10 w-28" />
                        </div>
                    </CardContent>
                </Card>

                {/* KnowledgeBaseEditor — Card */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded" />
                                    <Skeleton className="h-4 w-40" />
                                </div>
                                <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* WidgetSettings — Card */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                            <Skeleton className="h-6 w-11 rounded-full" />
                        </div>
                        <Skeleton className="h-20 w-full rounded-md" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
