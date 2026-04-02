'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConnectionStatus } from './ConnectionStatus';
import {
    Radio,
    Phone,
    Bot,
    Eye,
    PhoneOff,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { ActiveCall, ConnectionStatus as ConnectionStatusType } from '@/types/realtime';

interface ActiveCallsListProps {
    /** Base path for navigation (e.g. "/portal" for client users) */
    basePath?: string;
    /** Whether the user can end calls (default: true, set false for client users) */
    canEndCalls?: boolean;
}

export function ActiveCallsList({ basePath = '', canEndCalls = true }: ActiveCallsListProps) {
    const router = useRouter();
    const [calls, setCalls] = useState<ActiveCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState<string | null>(null);
    const [endConfirmCallId, setEndConfirmCallId] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>({
        connected: false,
        reconnecting: false,
    });
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasErrorToastRef = useRef(false);
    const endedCallIdsRef = useRef<Set<string>>(new Set());

    const fetchActiveCalls = useCallback(async () => {
        try {
            const response = await fetch('/api/calls/active');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.data) {
                // Filter out recently-ended calls to prevent zombie flicker
                const filtered = (result.data as ActiveCall[]).filter(
                    (c) => !endedCallIdsRef.current.has(c.id)
                );
                setCalls(filtered);
            }
            // Mark connection as healthy on successful fetch
            setConnectionStatus({
                connected: true,
                lastConnected: new Date(),
                reconnecting: false,
            });
            // Clear error toast flag on success
            hasErrorToastRef.current = false;
        } catch (err) {
            console.error('Failed to fetch active calls:', err);
            setConnectionStatus(prev => ({
                ...prev,
                connected: false,
                reconnecting: true,
            }));
            // Only show error toast once until connectivity is restored
            if (!hasErrorToastRef.current) {
                hasErrorToastRef.current = true;
                toast.error('Failed to load active calls', {
                    description: 'Check your connection and try again',
                });
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchActiveCalls();

        // Update duration every second for active calls
        const durationInterval = setInterval(() => {
            setCalls((prev) =>
                prev.map((call) => ({
                    ...call,
                    duration_seconds: Math.max(0, Math.floor(
                        (Date.now() - new Date(call.started_at).getTime()) / 1000
                    )),
                }))
            );
        }, 1000);

        // Poll for active calls every 5 seconds
        // Active calls are fetched from the provider API (Retell/Vapi/Bland),
        // not from the DB, so Supabase Realtime cannot detect them.
        pollIntervalRef.current = setInterval(fetchActiveCalls, 5000);

        return () => {
            clearInterval(durationInterval);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [fetchActiveCalls]);

    // Clean up ended call IDs after 15 seconds (3 poll cycles)
    useEffect(() => {
        const cleanup = setInterval(() => {
            endedCallIdsRef.current.clear();
        }, 15000);
        return () => clearInterval(cleanup);
    }, []);

    const handleEndCall = async (callId: string) => {
        const call = calls.find((c) => c.id === callId);
        setEnding(callId);
        try {
            const provider = call?.provider || 'retell';
            const response = await fetch(`/api/calls/${callId}/end?provider=${provider}`, { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to end call');
            }
            // Track ended call to prevent zombie flicker on next poll
            endedCallIdsRef.current.add(callId);
            // Remove from list immediately for better UX
            setCalls((prev) => prev.filter((c) => c.id !== callId));
            toast.success('Call ended', {
                description: call?.agent_name ? `Call with ${call.agent_name} has been terminated` : 'The call has been terminated successfully',
            });
        } catch (err) {
            console.error('Failed to end call:', err);
            toast.error('Failed to end call', {
                description: 'Please try again or check the call status',
            });
            // Refresh to get actual state
            fetchActiveCalls();
        } finally {
            setEnding(null);
        }
    };

    const formatDuration = (seconds: number) => {
        const safe = Math.max(0, seconds);
        const hours = Math.floor(safe / 3600);
        const mins = Math.floor((safe % 3600) / 60);
        const secs = Math.round(safe % 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const formatPhoneNumber = (call: ActiveCall) => {
        return call.direction === 'inbound' ? call.from_number : call.to_number;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Status bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {calls.length > 0 ? (
                            <>
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="font-medium">{calls.length} Active Call{calls.length !== 1 ? 's' : ''}</span>
                            </>
                        ) : (
                            <>
                                <span className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                <span className="text-muted-foreground">No active calls</span>
                            </>
                        )}
                    </div>
                    <ConnectionStatus status={connectionStatus} />
                    <span className="text-xs text-muted-foreground">Polling every 2s</span>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchActiveCalls} title="Refresh" aria-label="Refresh active calls">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Active calls */}
            {calls.length > 0 ? (
                <div className="grid gap-4">
                    {calls.map((call) => (
                        <Card key={call.id} className="border-l-4 border-l-primary animate-in fade-in slide-in-from-top-2 duration-300">
                            <CardContent className="py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <div className="relative shrink-0">
                                            <Radio className="h-8 w-8 text-primary" />
                                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse"></span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                                <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="font-medium truncate">{call.agent_name}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="truncate">{formatPhoneNumber(call) || 'Unknown'}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-sm text-muted-foreground">
                                                <Badge variant="outline" className="text-muted-foreground tabular-nums">
                                                    {formatDuration(call.duration_seconds)} elapsed
                                                </Badge>
                                                <span className="capitalize">{call.direction}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {call.provider}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.push(`${basePath}/live/${call.external_id}?provider=${call.provider}`)}
                                            className="sm:size-default"
                                        >
                                            <Eye className="h-4 w-4 sm:mr-2" />
                                            <span className="hidden sm:inline">View Live</span>
                                        </Button>
                                        {canEndCalls && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setEndConfirmCallId(call.id)}
                                                disabled={ending === call.id}
                                                className="sm:size-default"
                                            >
                                                {ending === call.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <PhoneOff className="h-4 w-4 sm:mr-2" />
                                                        <span className="hidden sm:inline">End Call</span>
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Radio className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No active calls</h3>
                        <p className="text-muted-foreground text-center max-w-md">
                            When calls are in progress, they&apos;ll appear here in real-time.
                            <span className="block mt-2 text-muted-foreground text-sm">
                                Auto-refreshing every 2 seconds
                            </span>
                        </p>
                    </CardContent>
                </Card>
            )}

            <AlertDialog open={!!endConfirmCallId} onOpenChange={(open: boolean) => !open && setEndConfirmCallId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>End this call?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will immediately terminate the active call. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (endConfirmCallId) {
                                    handleEndCall(endConfirmCallId);
                                    setEndConfirmCallId(null);
                                }
                            }}
                        >
                            End Call
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
