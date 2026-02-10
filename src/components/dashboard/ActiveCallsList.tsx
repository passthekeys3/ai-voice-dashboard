'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/lib/toast';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ActiveCall, ConnectionStatus as ConnectionStatusType } from '@/types/realtime';

export function ActiveCallsList() {
    const router = useRouter();
    const [calls, setCalls] = useState<ActiveCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>({
        connected: false,
        reconnecting: false,
    });
    const channelRef = useRef<RealtimeChannel | null>(null);
    const supabaseRef = useRef(createClient());
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchActiveCalls = useCallback(async () => {
        try {
            const response = await fetch('/api/calls/active');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.data) {
                setCalls(result.data);
            }
        } catch (err) {
            console.error('Failed to fetch active calls:', err);
            toast.error('Failed to load active calls', {
                description: 'Check your connection and try again',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const supabase = supabaseRef.current;

        // Initial fetch
        fetchActiveCalls();

        // Subscribe to real-time changes on the calls table
        // Wrapped in try-catch because Supabase Realtime may throw a DOMException
        // ("The operation is insecure") if WebSocket creation fails, which would
        // otherwise be caught by the ErrorBoundary and crash the page.
        try {
            const channel = supabase
                .channel('active-calls-realtime')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'calls',
                    },
                    (payload) => {
                        const newCall = payload.new as {
                            id: string;
                            external_id: string;
                            agent_id: string;
                            status: string;
                            started_at: string;
                            from_number?: string;
                            to_number?: string;
                            direction: string;
                            provider: 'retell' | 'vapi' | 'bland';
                        };

                        // Only add if it's an active call
                        if (newCall.status === 'in_progress' || newCall.status === 'queued') {
                            // Refresh to get full data including agent name
                            fetchActiveCalls();
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'calls',
                    },
                    (payload) => {
                        const updatedCall = payload.new as {
                            id: string;
                            status: string;
                        };

                        // If call ended, remove from active list
                        if (updatedCall.status === 'completed' || updatedCall.status === 'failed') {
                            setCalls((prev) => prev.filter((c) => c.id !== updatedCall.id));
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        setConnectionStatus({
                            connected: true,
                            lastConnected: new Date(),
                            reconnecting: false,
                        });
                    } else if (status === 'CLOSED') {
                        setConnectionStatus((prev) => ({
                            ...prev,
                            connected: false,
                            reconnecting: true,
                        }));
                    } else if (status === 'CHANNEL_ERROR') {
                        setConnectionStatus((prev) => ({
                            ...prev,
                            connected: false,
                            reconnecting: false,
                            error: 'Realtime unavailable',
                        }));
                        // Increase polling frequency when realtime fails
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                        }
                        pollIntervalRef.current = setInterval(fetchActiveCalls, 10000);
                    }
                });

            channelRef.current = channel;
        } catch (err) {
            // WebSocket creation failed (e.g. insecure context) — fall back to polling
            console.warn('Realtime subscription failed, using polling fallback:', err);
            setConnectionStatus({
                connected: false,
                reconnecting: false,
                error: 'Realtime unavailable',
            });
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
            pollIntervalRef.current = setInterval(fetchActiveCalls, 10000);
        }

        // Update duration every second for active calls
        const durationInterval = setInterval(() => {
            setCalls((prev) =>
                prev.map((call) => ({
                    ...call,
                    duration_seconds: Math.floor(
                        (Date.now() - new Date(call.started_at).getTime()) / 1000
                    ),
                }))
            );
        }, 1000);

        // Fallback polling every 30 seconds (reduced from 5s since we have real-time)
        pollIntervalRef.current = setInterval(fetchActiveCalls, 30000);

        return () => {
            clearInterval(durationInterval);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [fetchActiveCalls]);

    const handleEndCall = async (callId: string) => {
        if (!confirm('Are you sure you want to end this call?')) return;

        const call = calls.find((c) => c.id === callId);
        setEnding(callId);
        try {
            const response = await fetch(`/api/calls/${callId}/end`, { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to end call');
            }
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
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                                <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                                <span className="text-muted-foreground">No active calls</span>
                            </>
                        )}
                    </div>
                    <ConnectionStatus status={connectionStatus} />
                </div>
                <Button variant="ghost" size="icon" onClick={fetchActiveCalls} title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Active calls */}
            {calls.length > 0 ? (
                <div className="grid gap-4">
                    {calls.map((call) => (
                        <Card key={call.id} className="border-l-4 border-l-green-500 animate-in fade-in slide-in-from-top-2 duration-300">
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <Radio className="h-8 w-8 text-green-500" />
                                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Bot className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{call.agent_name}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{formatPhoneNumber(call) || 'Unknown'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                <Badge variant="outline" className="text-green-600 tabular-nums">
                                                    {formatDuration(call.duration_seconds)} elapsed
                                                </Badge>
                                                <span className="capitalize">{call.direction}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {call.provider}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => router.push(`/live/${call.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" />
                                            View Live
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleEndCall(call.id)}
                                            disabled={ending === call.id}
                                        >
                                            {ending === call.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <PhoneOff className="h-4 w-4 mr-2" />
                                                    End Call
                                                </>
                                            )}
                                        </Button>
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
                            {connectionStatus.connected ? (
                                <span className="block mt-2 text-green-600 text-sm">
                                    Real-time updates are active
                                </span>
                            ) : connectionStatus.error ? (
                                <span className="block mt-2 text-muted-foreground text-sm">
                                    Auto-refreshing every 10 seconds
                                </span>
                            ) : (
                                <span className="block mt-2 text-yellow-600 text-sm">
                                    Connecting to real-time updates...
                                </span>
                            )}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
