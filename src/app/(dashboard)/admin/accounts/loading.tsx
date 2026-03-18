export default function AdminAccountsLoading() {
    return (
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
            <div className="space-y-2">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-6 space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded" />
                ))}
            </div>
        </div>
    );
}
