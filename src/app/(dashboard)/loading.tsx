import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function DashboardLoading() {
    return (
        <div className="flex flex-col h-full">
            {/* Header skeleton */}
            <header className="flex h-16 flex-shrink-0 items-center justify-between bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
                <Skeleton className="h-5 w-28" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* KPI Cards — clean cards, no colored borders */}
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-4 rounded" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Charts + Agents */}
                <div className="grid gap-4 md:grid-cols-7">
                    <Card className="md:col-span-4">
                        <CardHeader>
                            <Skeleton className="h-5 w-28" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] flex items-end gap-2">
                                {[45, 72, 38, 85, 52, 68, 41, 79, 55, 63, 48, 76].map((h, i) => (
                                    <Skeleton
                                        key={i}
                                        className="flex-1 rounded-t-sm"
                                        style={{ height: `${h}%` }}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-3 min-w-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-3 w-14" />
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="space-y-1">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between py-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-10" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Calls — no card wrapper */}
                <div>
                    <Skeleton className="h-6 w-28 mb-3" />
                    <div className="rounded-md border">
                        <div className="border-b px-4 py-3 flex gap-6">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 w-16" />
                            ))}
                        </div>
                        <div className="divide-y">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="px-4 py-3 flex items-center gap-6">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-14" />
                                    <Skeleton className="h-4 w-14" />
                                    <div className="ml-auto flex gap-2">
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
