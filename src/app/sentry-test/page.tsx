'use client';

import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
    const client = Sentry.getClient();
    const dsn = client?.getDsn();
    const isInitialized = !!dsn;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
            <h1 className="text-2xl font-bold">Sentry Test Page</h1>

            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-mono">
                <p>Sentry initialized: <strong className={isInitialized ? 'text-green-600' : 'text-red-600'}>{isInitialized ? 'YES' : 'NO'}</strong></p>
                <p>DSN: {dsn ? `${dsn.host}` : 'not set'}</p>
                <p>NEXT_PUBLIC_SENTRY_DSN: {process.env.NEXT_PUBLIC_SENTRY_DSN ? 'set' : 'NOT SET'}</p>
            </div>

            <p className="text-muted-foreground">Click a button to trigger a test error.</p>

            <div className="flex gap-4">
                <Button
                    variant="destructive"
                    onClick={() => {
                        throw new Error('Sentry test: client-side error from button click');
                    }}
                >
                    Throw Error (ErrorBoundary)
                </Button>

                <Button
                    variant="outline"
                    onClick={() => {
                        const eventId = Sentry.captureException(
                            new Error('Sentry test: manual captureException')
                        );
                        alert(`Error sent to Sentry!\nEvent ID: ${eventId}\nCheck your dashboard.`);
                    }}
                >
                    Manual captureException
                </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-8">
                After clicking, check your Sentry Issues dashboard within 30 seconds.
            </p>
        </div>
    );
}
