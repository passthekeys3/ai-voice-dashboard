export default function AgentsLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
            </div>

            {/* Agent cards grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <div className="h-5 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                                <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
                            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
