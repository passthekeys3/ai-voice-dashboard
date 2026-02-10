'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConnectionStatus } from './ConnectionStatus';
import {
    Radio,
    Phone,
    Bot,
    User,
    PhoneOff,
    Loader2,
    Clock,
    CheckCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConnectionStatus as ConnectionStatusType } from '@/types/realtime';

interface TranscriptLine {
    speaker: 'agent' | 'user';
    text: string;
    isNew?: boolean;
}

interface LiveCall {
    id: string;
    agent_name: string;
    status: string;
    started_at: string;
    duration_seconds: number;
    from_number?: string;
    to_number?: string;
    direction: string;
    transcript: TranscriptLine[];
    is_active: boolean;
}

interface LiveTranscriptProps {
    callId: string;
}

// Parse Retell transcript format into structured lines
function parseTranscript(transcript: string): TranscriptLine[] {
    if (!transcript) return [];

    const lines: TranscriptLine[] = [];
    const parts = transcript.split('\n').filter(line => line.trim());

    for (const part of parts) {
        if (part.startsWith('Agent:')) {
            lines.push({ speaker: 'agent', text: part.replace('Agent:', '').trim() });
        } else if (part.startsWith('User:')) {
            lines.push({ speaker: 'user', text: part.replace('User:', '').trim() });
        } else if (lines.length > 0) {
            lines[lines.length - 1].text += ' ' + part.trim();
        }
    }

    return lines;
}

export function LiveTranscript({ callId }: LiveTranscriptProps) {
    const router = useRouter();
    const [call, setCall] = useState<LiveCall | null>(null);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>({
        connected: false,
        reconnecting: false,
    });
    const transcriptRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [prevLineCount, setPrevLineCount] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const lastActivityRef = useRef<number>(Date.now());
    const isActiveRef = useRef(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const supabaseRef = useRef(createClient());
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchCall = useCallback(async () => {
        try {
            const response = await fetch(`/api/calls/${callId}/live`);
            if (!response.ok) {
                if (response.status === 404) {
                    setError('Call not found or has ended');
                    return;
                }
                throw new Error('Failed to fetch call');
            }
            const result = await response.json();
            const newCall = result.data as LiveCall;

            // Mark new lines
            if (newCall.transcript.length > prevLineCount) {
                newCall.transcript = newCall.transcript.map((line, idx) => ({
                    ...line,
                    isNew: idx >= prevLineCount,
                }));
                setPrevLineCount(newCall.transcript.length);
                lastActivityRef.current = Date.now();

                // Clear "new" flag after animation
                setTimeout(() => {
                    setCall(prev => prev ? {
                        ...prev,
                        transcript: prev.transcript.map(l => ({ ...l, isNew: false }))
                    } : null);
                }, 1000);
            }

            // Show typing indicator if call is active and recent activity
            if (newCall.is_active) {
                const timeSinceActivity = Date.now() - lastActivityRef.current;
                setIsTyping(timeSinceActivity < 5000);
            } else {
                setIsTyping(false);
            }

            setCall(newCall);
            isActiveRef.current = newCall.is_active;
            setError(null);
        } catch (err) {
            console.error('Failed to fetch call:', err);
            setError('Failed to load call data');
        } finally {
            setLoading(false);
        }
    }, [callId, prevLineCount]);

    useEffect(() => {
        const supabase = supabaseRef.current;

        // Initial fetch
        fetchCall();

        // Subscribe to real-time changes for this specific call
        const channel = supabase
            .channel(`live-transcript:${callId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'calls',
                    filter: `id=eq.${callId}`,
                },
                (payload) => {
                    const updatedCall = payload.new as {
                        id: string;
                        status: string;
                        duration_seconds: number;
                        transcript?: string;
                        ended_at?: string;
                    };

                    setCall((prev) => {
                        if (!prev) return null;

                        const newTranscript = parseTranscript(updatedCall.transcript || '');
                        const currentLineCount = prev.transcript.length;

                        // Mark new lines
                        const markedTranscript = newTranscript.map((line, idx) => ({
                            ...line,
                            isNew: idx >= currentLineCount,
                        }));

                        if (newTranscript.length > currentLineCount) {
                            setPrevLineCount(newTranscript.length);
                            lastActivityRef.current = Date.now();
                            setIsTyping(true);

                            // Clear "new" flag after animation
                            setTimeout(() => {
                                setCall(p => p ? {
                                    ...p,
                                    transcript: p.transcript.map(l => ({ ...l, isNew: false }))
                                } : null);
                            }, 1000);
                        }

                        const isActive = updatedCall.status === 'in_progress' || updatedCall.status === 'ongoing';
                        isActiveRef.current = isActive;

                        if (!isActive) {
                            setIsTyping(false);
                        }

                        return {
                            ...prev,
                            status: updatedCall.status,
                            duration_seconds: updatedCall.duration_seconds || prev.duration_seconds,
                            transcript: markedTranscript,
                            is_active: isActive,
                        };
                    });
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
                    // Already polling at 3s, no change needed — polling handles updates
                }
            });

        channelRef.current = channel;

        // Update duration every second if call is active
        const durationInterval = setInterval(() => {
            setCall((prev) => {
                if (!prev || !prev.is_active) return prev;
                return {
                    ...prev,
                    duration_seconds: Math.floor(
                        (Date.now() - new Date(prev.started_at).getTime()) / 1000
                    ),
                };
            });
        }, 1000);

        // Reset typing indicator if no activity
        const typingInterval = setInterval(() => {
            const timeSinceActivity = Date.now() - lastActivityRef.current;
            if (timeSinceActivity > 5000) {
                setIsTyping(false);
            }
        }, 1000);

        // Fallback polling every 3 seconds for transcript updates
        // (webhooks may have delays, this ensures we catch all updates)
        pollIntervalRef.current = setInterval(() => {
            if (isActiveRef.current) {
                fetchCall();
            }
        }, 3000);

        return () => {
            clearInterval(durationInterval);
            clearInterval(typingInterval);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [callId, fetchCall]);

    // Auto-scroll to bottom when new transcript arrives
    useEffect(() => {
        if (autoScroll && transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [call?.transcript, autoScroll]);

    const handleEndCall = async () => {
        if (!confirm('Are you sure you want to end this call?')) return;

        setEnding(true);
        try {
            await fetch(`/api/calls/${callId}/end`, { method: 'POST' });
            router.push('/live');
        } catch (err) {
            console.error('Failed to end call:', err);
        } finally {
            setEnding(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !call) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">{error || 'Call ended'}</h3>
                    <p className="text-muted-foreground mb-4">
                        This call is no longer active
                    </p>
                    <Button onClick={() => router.push('/live')}>
                        Back to Live Calls
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Call Info Bar */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {call.is_active ? (
                                <div className="relative">
                                    <Radio className="h-8 w-8 text-green-500" />
                                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>
                                </div>
                            ) : (
                                <CheckCircle className="h-8 w-8 text-gray-400" />
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <Bot className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{call.agent_name}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{call.direction === 'inbound' ? call.from_number : call.to_number}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm">
                                    <Badge variant={call.is_active ? 'default' : 'secondary'}>
                                        <Clock className="h-3 w-3 mr-1" />
                                        <span className="tabular-nums">{formatDuration(call.duration_seconds)}</span>
                                    </Badge>
                                    {call.is_active ? (
                                        <Badge className="bg-green-500">
                                            <span className="relative flex h-2 w-2 mr-1">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                            </span>
                                            Live
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">Ended</Badge>
                                    )}
                                    <ConnectionStatus status={connectionStatus} />
                                </div>
                            </div>
                        </div>
                        {call.is_active && (
                            <Button
                                variant="destructive"
                                onClick={handleEndCall}
                                disabled={ending}
                            >
                                {ending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <PhoneOff className="h-4 w-4 mr-2" />
                                        End Call
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Live Transcript */}
            <Card className="flex flex-col h-[500px]">
                <CardHeader className="flex-none flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        Live Transcript
                        {call.is_active && connectionStatus.connected && (
                            <span className="text-xs font-normal text-green-600">
                                (real-time)
                            </span>
                        )}
                        {call.is_active && connectionStatus.error && (
                            <span className="text-xs font-normal text-muted-foreground">
                                (polling)
                            </span>
                        )}
                    </CardTitle>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="rounded"
                        />
                        Auto-scroll
                    </label>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <div
                        ref={transcriptRef}
                        className="h-full overflow-y-auto p-4 space-y-3"
                    >
                        {call.transcript.length > 0 ? (
                            <>
                                {call.transcript.map((line, index) => (
                                    <div
                                        key={index}
                                        className={`flex gap-3 transition-all duration-300 ${line.speaker === 'agent' ? '' : 'flex-row-reverse'
                                            } ${line.isNew ? 'animate-in fade-in slide-in-from-bottom-2' : ''}`}
                                    >
                                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${line.speaker === 'agent'
                                            ? 'bg-blue-100 text-blue-600'
                                            : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {line.speaker === 'agent' ? (
                                                <Bot className="h-4 w-4" />
                                            ) : (
                                                <User className="h-4 w-4" />
                                            )}
                                        </div>
                                        <div className={`flex-1 max-w-[80%] rounded-lg p-3 ${line.speaker === 'agent'
                                            ? 'bg-blue-50 text-blue-900'
                                            : 'bg-gray-100 text-gray-900'
                                            } ${line.isNew ? 'ring-2 ring-green-400 ring-opacity-50' : ''}`}>
                                            <p className="text-sm">{line.text}</p>
                                        </div>
                                    </div>
                                ))}

                                {/* Typing indicator */}
                                {isTyping && call.is_active && (
                                    <div className="flex gap-3 animate-in fade-in">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-600">
                                            <Bot className="h-4 w-4" />
                                        </div>
                                        <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : call.is_active ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <Radio className="h-8 w-8 mx-auto mb-2 text-green-500 animate-pulse" />
                                    <p className="font-medium">Call in progress</p>
                                    <p className="text-sm mt-1">Waiting for conversation to begin...</p>
                                    <div className="flex justify-center gap-1 mt-4">
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <p>No transcript available</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
