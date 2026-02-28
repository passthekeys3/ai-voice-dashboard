'use client';

import { useEffect } from 'react';

export default function WidgetError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Widget error:', error);
        import('@sentry/nextjs').then(Sentry => {
            Sentry.captureException(error);
        }).catch(() => {});
    }, [error]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            padding: '1rem',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
        }}>
            <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Something went wrong loading the widget.
            </p>
            <button
                onClick={reset}
                style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                }}
            >
                Try again
            </button>
        </div>
    );
}
