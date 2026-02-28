export default function UpgradeLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Centered header */}
            <div className="text-center space-y-2">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded mx-auto" />
            </div>

            {/* 3-column pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                        <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, j) => (
                                <div key={j} className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                            ))}
                        </div>
                        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
