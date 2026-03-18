import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AnalyticsLoading() {
    return (
        <div className="flex flex-col h-full">
            <header className="flex h-16 flex-shrink-0 items-center justify-between bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
                <Skeleton className="h-5 w-24" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                {/* Filter buttons — right aligned */}
                <div className="flex justify-end">
                    <Skeleton className="h-10 w-72" />
                </div>

                {/* KPI Cards — clean, no colored borders */}
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

                {/* Charts */}
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
                        <CardHeader>
                            <Skeleton className="h-5 w-28" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Skeleton className="h-4 w-28" />
                                            <Skeleton className="h-4 w-16" />
                                        </div>
                                        <Skeleton className="h-2 w-full rounded-full" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Additional metrics */}
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2].map((i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-5 w-40" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-10 w-24" />
                                <Skeleton className="h-4 w-56 mt-1" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
