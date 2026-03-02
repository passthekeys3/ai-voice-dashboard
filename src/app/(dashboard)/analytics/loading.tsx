import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AnalyticsLoading() {
    return (
        <div className="flex flex-col h-full">
            {/* Header bar */}
            <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 px-4 sm:px-6">
                <Skeleton className="h-5 w-24" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                {/* Page title + filter — flex row with title left, filters right */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>

                {/* KPI Cards — matches AnalyticsCards with border-l-4 accents */}
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {(['blue', 'green', 'amber', 'purple'] as const).map((color) => (
                        <Card
                            key={color}
                            className={`border-l-4 ${
                                color === 'blue' ? 'border-l-blue-500' :
                                color === 'green' ? 'border-l-green-500' :
                                color === 'amber' ? 'border-l-amber-500' :
                                'border-l-purple-500'
                            }`}
                        >
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-8 w-20" />
                                <Skeleton className="h-3 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Charts — grid gap-4 md:grid-cols-7 (chart 4 + agents 3) */}
                <div className="grid gap-4 md:grid-cols-7">
                    {/* UsageChart — col-span-4 */}
                    <Card className="md:col-span-4">
                        <CardHeader>
                            <Skeleton className="h-6 w-28" />
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

                    {/* Calls by Agent — col-span-3 with progress bars */}
                    <Card className="md:col-span-3 min-w-0">
                        <CardHeader>
                            <Skeleton className="h-6 w-28" />
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

                {/* Additional metrics — grid gap-4 md:grid-cols-2 */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-40" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-10 w-24" />
                            <Skeleton className="h-4 w-56 mt-1" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-28" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-10 w-20" />
                            <Skeleton className="h-4 w-40 mt-1" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
