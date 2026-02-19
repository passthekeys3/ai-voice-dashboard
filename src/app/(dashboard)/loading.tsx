export default function DashboardLoading() {
    return (
        <div className="space-y-6 p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* KPI cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-3"
                    >
                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                        <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </div>
                ))}
            </div>

            {/* Chart skeleton */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                <div className="h-5 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Table skeleton */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
