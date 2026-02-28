export default function LiveCallDetailLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Back button */}
            <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />

            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Split view cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                    <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-72 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                    <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-72 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
            </div>
        </div>
    );
}
