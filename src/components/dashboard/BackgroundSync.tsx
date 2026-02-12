'use client';

import { useEffect, useRef } from 'react';

/**
 * Background sync hook that triggers a sync on mount (first dashboard visit)
 * Uses sessionStorage to only sync once per browser session
 */
export function useBackgroundSync() {
    const syncAttempted = useRef(false);

    useEffect(() => {
        // Only sync once per component mount and once per session
        if (syncAttempted.current) return;

        const lastSync = sessionStorage.getItem('buildvoiceai_last_sync');
        const now = Date.now();

        // Don't sync if we synced in the last 5 minutes
        if (lastSync && (now - parseInt(lastSync)) < 5 * 60 * 1000) {
            return;
        }

        syncAttempted.current = true;

        const controller = new AbortController();

        fetch('/api/sync', {
            method: 'POST',
            signal: controller.signal,
        })
            .then((res) => {
                if (controller.signal.aborted) return;
                if (res.ok) {
                    sessionStorage.setItem('buildvoiceai_last_sync', now.toString());
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('[BackgroundSync] Sync completed successfully');
                    }
                } else {
                    console.warn('[BackgroundSync] Sync returned non-OK status');
                }
            })
            .catch((err) => {
                if (err instanceof Error && err.name === 'AbortError') return;
                console.error('[BackgroundSync] Sync failed:', err);
            });

        return () => controller.abort();
    }, []);
}

/**
 * Component that triggers background sync when mounted
 * Add this to your dashboard layout
 */
export function BackgroundSync() {
    useBackgroundSync();
    return null;
}
