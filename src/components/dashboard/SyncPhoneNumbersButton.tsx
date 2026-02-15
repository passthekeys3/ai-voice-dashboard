'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SyncPhoneNumbersButton() {
    const router = useRouter();
    const [syncing, setSyncing] = useState(false);
    const handleSync = async () => {
        setSyncing(true);

        try {
            const response = await fetch('/api/phone-numbers/sync', { method: 'POST' });
            const data = await response.json();

            if (response.ok) {
                toast.success(`Synced: ${data.synced} added, ${data.updated} updated`);
                router.refresh();
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch (err) {
            console.error('Failed to sync:', err);
            toast.error('Network error — please try again.');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
        >
            {syncing ? (
                <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
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
