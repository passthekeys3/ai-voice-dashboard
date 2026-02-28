export default function BillingLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-52 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Plan info card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-3">
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
                <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>

            {/* Usage card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-3">
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Invoices card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-3">
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    ))}
                </div>
            </div>
        </div>
    );
}
