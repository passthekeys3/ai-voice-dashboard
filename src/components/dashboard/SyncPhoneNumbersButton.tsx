'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function SyncPhoneNumbersButton() {
    const router = useRouter();
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState<{ synced: number; updated: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSync = async () => {
        setSyncing(true);
        setResult(null);
        setError(null);

        try {
            console.log('Starting sync...');
            const response = await fetch('/api/phone-numbers/sync', { method: 'POST' });
            console.log('Sync response status:', response.status);
            const data = await response.json();
            console.log('Sync response data:', data);

            if (response.ok) {
                setResult({ synced: data.synced, updated: data.updated });
                router.refresh();
                setTimeout(() => setResult(null), 5000);
            } else {
                setError(data.error || 'Sync failed');
                setTimeout(() => setError(null), 5000);
            }
        } catch (err) {
            console.error('Failed to sync:', err);
            setError('Network error');
            setTimeout(() => setError(null), 5000);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <Button
            variant={error ? 'destructive' : 'outline'}
            onClick={handleSync}
            disabled={syncing}
        >
            {syncing ? (
                <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                </>
            ) : error ? (
                <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {error}
                </>
            ) : result ? (
                <>
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    {result.synced} added, {result.updated} updated
                </>
            ) : (
                <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync from Retell
                </>
            )}
        </Button>
    );
}
