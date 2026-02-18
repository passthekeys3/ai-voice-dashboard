'use client';

import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
            <h1 className="text-2xl font-bold">Sentry Test Page</h1>
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
                        Sentry.captureException(
                            new Error('Sentry test: manual captureException')
                        );
                        alert('Error sent to Sentry! Check your dashboard.');
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
