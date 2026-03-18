import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ClientDetailLoading() {
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

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Back button + icon + name + badge + invite button */}
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <div>
                            <Skeleton className="h-8 w-44" />
                            <Skeleton className="h-4 w-36 mt-1" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-14 rounded-full" />
                    <Skeleton className="h-10 w-28 rounded-md ml-auto" />
                </div>

                {/* 3-col KPI cards — Agents, Total Calls, Users */}
                <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-2">
                                <Skeleton className="h-4 w-20" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-12" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Assigned Agents Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-8 w-28" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <Card key={i}>
                                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-9 w-9 rounded-lg" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-5 w-28" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-5 w-14 rounded-full" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-8 w-20 rounded-md" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Calls Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-8 w-28" />
                    </CardHeader>
                    <CardContent>
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Users Section — Card with user list */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-8 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div>
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-3 w-36 mt-1" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Permissions Section */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                                <Skeleton className="h-6 w-11 rounded-full" />
                            </div>
                        ))}
                        <Skeleton className="h-10 w-40" />
                    </CardContent>
                </Card>

                {/* API Keys Section */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ))}
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>

                {/* Integrations Section */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>

                {/* Billing Section */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>

                {/* Bottom 2-col grid — Client Details + Branding */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-28" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-24 mt-1" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-20" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-64" />
                        </CardContent>
                    </Card>
                </div>

                {/* Delete Client — danger zone */}
                <Card className="border-red-200 dark:border-red-900/50">
                    <CardHeader>
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
