'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SyncPhoneNumbersButtonProps {
    onSyncComplete?: () => void;
}

export function SyncPhoneNumbersButton({ onSyncComplete }: SyncPhoneNumbersButtonProps) {
    const [syncing, setSyncing] = useState(false);
    const handleSync = async () => {
        setSyncing(true);

        try {
            const response = await fetch('/api/phone-numbers/sync', { method: 'POST' });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                toast.error(errData.error || 'Sync failed');
                return;
            }

            const data = await response.json();
            toast.success(`Synced: ${data.synced} added, ${data.updated} updated`);
            onSyncComplete?.();
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
                    Sync from Providers
                </>
            )}
        </Button>
    );
}
