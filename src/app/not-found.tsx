import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit">
                    <FileQuestion className="h-10 w-10 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Page not found
                    </h1>
                    <p className="text-muted-foreground">
                        The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    </p>
                </div>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                >
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}
