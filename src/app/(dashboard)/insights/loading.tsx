export default function InsightsLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-5 space-y-3">
                        <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                ))}
            </div>

            {/* 2 chart areas side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6">
                        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
                        <div className="h-56 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
