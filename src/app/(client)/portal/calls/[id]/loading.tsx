export default function CallDetailLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            {/* Back button */}
            <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />

            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-52 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>

            {/* Call detail card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800/60 rounded" />
                <div className="h-4 w-44 bg-slate-100 dark:bg-slate-800/60 rounded" />
                <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800/60 rounded" />
                <div className="h-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
        </div>
    );
}
