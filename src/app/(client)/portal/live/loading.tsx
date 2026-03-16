import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function LiveLoading() {
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
                {/* Page title */}
                <div>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-52 mt-2" />
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-3 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-9 w-24 rounded-md" />
                </div>

                {/* Active call cards */}
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <Card key={i} className="border-l-4 border-l-green-500">
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <Skeleton className="h-5 w-32" />
                                            <Skeleton className="h-4 w-24 mt-1" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-5 w-16" />
                                        <Skeleton className="h-9 w-20 rounded-md" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
