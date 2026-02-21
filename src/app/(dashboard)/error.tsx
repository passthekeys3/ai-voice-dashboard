'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Dashboard error:', error);
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
                    {error.message && (
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <p className="text-sm font-mono text-muted-foreground break-all">
                                {error.message}
                            </p>
                        </div>
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
