import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function DashboardLoading() {
    return (
        <div className="flex flex-col h-full">
            {/* Header skeleton — matches Header.tsx (h-16, border-b, px-4/6) */}
            <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 px-4 sm:px-6">
                <Skeleton className="h-5 w-28" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-6 sm:space-y-8">
                {/* Welcome text — matches page.tsx heading */}
                <div className="space-y-2">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-80" />
                </div>

                {/* KPI Cards — matches AnalyticsCards grid + Card with border-l-4 */}
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

                {/* Charts + Agents — matches grid gap-4 md:grid-cols-7 */}
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

                    {/* Your Agents — col-span-3, matches page.tsx agents card */}
                    <Card className="md:col-span-3 min-w-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-28" />
                                <Skeleton className="h-5 w-5 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-14" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Calls — matches the Card > CardHeader > CallsTable structure */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-28" />
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <div className="border-b px-4 py-3 flex gap-6">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-4 w-16" />
                                ))}
                            </div>
                            <div className="divide-y">
                                {Array.from({ length: 5 }).map((_, rowIndex) => (
                                    <div key={rowIndex} className="px-4 py-3 flex items-center gap-6">
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
