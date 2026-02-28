export default function BillingLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-52 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Plan info card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-44 bg-slate-100 dark:bg-slate-800/60 rounded" />
                <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>

            {/* Payment history card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    ))}
                </div>
            </div>
        </div>
    );
}
