'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function SyncButton() {
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const router = useRouter();

    const handleSync = async () => {
        setSyncing(true);
        setResult(null);

        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
            });

            const data = await response.json();

            if (!response.ok) {
                setResult(`Error: ${data.error}`);
                return;
            }

            setResult(`Synced ${data.results.agents.synced} agents, ${data.results.calls.synced} calls`);
            router.refresh();
        } catch (_err) {
            setResult('Failed to sync');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="flex items-center gap-4">
            <Button onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync from Providers'}
            </Button>
            {result && (
                <span className={`text-sm ${result.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                    {result}
                </span>
            )}
        </div>
    );
}
