import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function BillingLoading() {
    return (
        <div className="flex flex-col h-full">
            {/* Header bar */}
            <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
                <Skeleton className="h-5 w-16" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                {/* Page title */}
                <div>
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-72 mt-2" />
                </div>

                {/* BillingSection (Suspense) — subscription management */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-10 w-40" />
                    </CardContent>
                </Card>

                {/* Current Period — 3-col stats grid */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-28" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="space-y-1">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-9 w-16" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* StripeConnectSection (Suspense) — client billing */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-56" />
                        <Skeleton className="h-10 w-40" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
