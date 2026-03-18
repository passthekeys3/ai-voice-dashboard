import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CallsLoading() {
    return (
        <div className="flex flex-col h-full">
            {/* Header bar */}
            <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6">
                <Skeleton className="h-5 w-24" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Title + Export button row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-52 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-28 rounded-md" />
                </div>

                {/* CallsPageClient wraps everything in a Card */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <Skeleton className="h-6 w-20" />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                {/* Date range filters */}
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-9 w-[140px]" />
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-9 w-[140px]" />
                                </div>
                                {/* Search input */}
                                <Skeleton className="h-9 w-full sm:w-64" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Table */}
                        <div className="rounded-md border">
                            <div className="border-b px-4 py-3 flex gap-6">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                            <div className="divide-y">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div key={i} className="px-4 py-3 flex items-center gap-6">
                                        <Skeleton className="h-4 w-4" />
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-6 w-20 rounded-full" />
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-4 w-14" />
                                        <Skeleton className="h-4 w-14" />
                                        <Skeleton className="h-4 w-20" />
                                        <div className="ml-auto flex gap-2">
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between mt-4">
                            <Skeleton className="h-4 w-32" />
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-9 w-9 rounded-md" />
                                <Skeleton className="h-9 w-9 rounded-md" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
