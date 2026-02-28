export default function NewTestLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-52 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Form card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-5">
                <div className="space-y-2">
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="space-y-2">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="space-y-2">
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-24 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
        </div>
    );
}
