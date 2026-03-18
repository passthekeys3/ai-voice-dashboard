import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function SettingsLoading() {
    return (
        <div className="flex flex-col h-full">
            {/* Header bar */}
            <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
                <Skeleton className="h-5 w-20" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                {/* Page title */}
                <div>
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-4 w-80 mt-2" />
                </div>

                {/* AI Usage Card — matches AIUsageCard */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-4">
                            <div>
                                <Skeleton className="h-9 w-16" />
                                <Skeleton className="h-4 w-24 mt-1" />
                            </div>
                            <Skeleton className="h-6 w-4" />
                            <div>
                                <Skeleton className="h-9 w-16" />
                                <Skeleton className="h-4 w-20 mt-1" />
                            </div>
                        </div>
                        <Skeleton className="h-3 w-80 mt-3" />
                    </CardContent>
                </Card>

                {/* SettingsForm — Card with API key fields */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Agency name + branding fields */}
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        {/* API key fields */}
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ))}
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>

                {/* Custom Domain Settings */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-28" />
                    </CardContent>
                </Card>

                {/* Client Permissions */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-72" />
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

                {/* Delete Account Section */}
                <Card className="border-red-200 dark:border-red-900/50">
                    <CardHeader>
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-36" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
