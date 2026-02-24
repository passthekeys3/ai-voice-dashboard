export default function WorkflowsLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>

            {/* Table skeleton */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                {/* Table header */}
                <div className="flex gap-4">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                {/* Table rows */}
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
