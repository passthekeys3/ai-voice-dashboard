'use client';
import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack } as Record<string, unknown>,
        });
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: undefined });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-[400px] p-6">
                    <Card className="max-w-md w-full">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 p-3 rounded-full bg-red-50 dark:bg-red-950 w-fit">
                                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                            <CardTitle>Something went wrong</CardTitle>
                            <CardDescription>
                                An unexpected error occurred. Please try refreshing the page.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {this.state.error && (
                                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                                    <p className="text-sm font-mono text-muted-foreground break-all">
                                        {this.state.error.message}
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-3 justify-center">
                                <Button variant="outline" onClick={this.handleReset}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Try Again
                                </Button>
                                <Button onClick={() => window.location.reload()}>
                                    Refresh Page
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
