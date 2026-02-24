export default function SettingsLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Settings cards skeleton */}
            {Array.from({ length: 3 }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4"
                >
                    <div className="space-y-2">
                        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </div>
                    <div className="space-y-3">
                        <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                        <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                        <div className="h-10 w-1/3 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}
