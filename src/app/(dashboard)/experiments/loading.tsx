export default function ExperimentsLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header + action button */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>

            {/* Experiment cards */}
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                            <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
                        </div>
                        <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
