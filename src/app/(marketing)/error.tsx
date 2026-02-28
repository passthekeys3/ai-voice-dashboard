'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MarketingError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Marketing page error:', error);
        // Report to Sentry for monitoring
        import('@sentry/nextjs').then(Sentry => {
            Sentry.captureException(error);
        }).catch(() => {
            // Sentry not available, error already logged to console
        });
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 p-3 rounded-full bg-red-50 dark:bg-red-950 w-fit">
                        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <CardTitle>Something went wrong</CardTitle>
                    <CardDescription>
                        An unexpected error occurred. Please try again.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error.digest && (
                        <p className="text-xs text-center text-muted-foreground">
                            Error ID: {error.digest}
                        </p>
                    )}
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={reset}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Try Again
                        </Button>
                        <Button onClick={() => window.location.href = '/'}>
                            <Home className="h-4 w-4 mr-2" />
                            Go Home
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
