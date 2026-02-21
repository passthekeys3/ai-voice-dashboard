'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import {
    Radio,
    Phone,
    Bot,
    User,
    PhoneOff,
    Loader2,
    Clock,
    AlertCircle,
    Zap,
    RotateCw,
    Mic,
    MicOff,
    MessageSquare,
    Send,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { ConnectionStatus as ConnectionStatusType } from '@/types/realtime';
import { createClient } from '@/lib/supabase/client';

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
    provider?: string;
}

interface LiveTranscriptProps {
    callId: string;
    provider?: string;
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

export function LiveTranscript({ callId, provider: providerProp = 'retell' }: LiveTranscriptProps) {
    const router = useRouter();
    const [call, setCall] = useState<LiveCall | null>(null);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>({
        connected: false,
        reconnecting: false,
    });
    const transcriptRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const prevLineCountRef = useRef(0);
    const [isTyping, setIsTyping] = useState(false);
    const lastActivityRef = useRef<number>(Date.now());
    const isActiveRef = useRef(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const newLineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const supabaseRef = useRef(createClient());
    const lastUpdateSourceRef = useRef<'realtime' | 'poll' | 'initial'>('initial');
    const [lastUpdateInfo, setLastUpdateInfo] = useState<{ source: 'realtime' | 'poll'; time: Date } | null>(null);

    // Vapi call control state
    const [isMuted, setIsMuted] = useState(false);
    const [sayMessage, setSayMessage] = useState('');
    const [sendingSay, setSendingSay] = useState(false);
    const [togglingMute, setTogglingMute] = useState(false);

    // Apply transcript update to state — used by both fetch and realtime
    const applyTranscriptUpdate = useCallback((newCall: LiveCall) => {
        // Mark new lines
        if (newCall.transcript.length > prevLineCountRef.current) {
            newCall.transcript = newCall.transcript.map((line, idx) => ({
                ...line,
                isNew: idx >= prevLineCountRef.current,
            }));
            prevLineCountRef.current = newCall.transcript.length;
            lastActivityRef.current = Date.now();

            // Record the source of this update (realtime vs poll)
            if (lastUpdateSourceRef.current !== 'initial') {
                setLastUpdateInfo({ source: lastUpdateSourceRef.current, time: new Date() });
            }

            // Clear "new" flag after animation (with cleanup to prevent memory leak)
            if (newLineTimeoutRef.current) {
                clearTimeout(newLineTimeoutRef.current);
            }
            newLineTimeoutRef.current = setTimeout(() => {
                setCall(prev => prev ? {
                    ...prev,
                    transcript: prev.transcript.map(l => ({ ...l, isNew: false }))
                } : null);
                newLineTimeoutRef.current = null;
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
    }, []);

    // AbortController ref for cancelling in-flight fetch requests on unmount
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchCall = useCallback(async () => {
        // Cancel any previous in-flight request
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const response = await fetch(`/api/calls/${callId}/live?provider=${providerProp}`, {
                signal: controller.signal,
            });
            if (!response.ok) {
                if (response.status === 404) {
                    setError('Call not found or has ended');
                    return;
                }
                throw new Error('Failed to fetch call');
            }
            const result = await response.json();
            applyTranscriptUpdate(result.data as LiveCall);
        } catch (err) {
            // Ignore abort errors — these are expected on cleanup
            if (err instanceof DOMException && err.name === 'AbortError') return;
            console.error('Failed to fetch call:', err);
            setError('Failed to load call data');
        } finally {
            setLoading(false);
        }
    }, [callId, providerProp, applyTranscriptUpdate]);

    useEffect(() => {
        const supabase = supabaseRef.current;

        // Initial fetch
        fetchCall();

        // Subscribe to Supabase Broadcast for instant transcript updates.
        // The webhook handler broadcasts to this channel after writing to DB.
        // Uses Broadcast (not postgres_changes) because RLS on the calls table
        // blocks postgres_changes from delivering events to the anon client.
        const channel = supabase
            .channel(`call:${callId}:transcript`)
            .on(
                'broadcast',
                { event: 'call:transcript' },
                () => {
                    // Transcript updated — re-fetch to get parsed data
                    lastUpdateSourceRef.current = 'realtime';
                    fetchCall();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setConnectionStatus({ connected: true, lastConnected: new Date(), reconnecting: false });
                } else if (status === 'CLOSED') {
                    setConnectionStatus(prev => ({ ...prev, connected: false, reconnecting: true }));
                } else if (status === 'CHANNEL_ERROR') {
                    setConnectionStatus(prev => ({ ...prev, connected: false, error: 'Channel error' }));
                }
            });

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

        // Fallback polling every 5 seconds (in case Realtime misses an update)
        pollIntervalRef.current = setInterval(() => {
            if (isActiveRef.current) {
                lastUpdateSourceRef.current = 'poll';
                fetchCall();
            }
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(durationInterval);
            clearInterval(typingInterval);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
            if (newLineTimeoutRef.current) {
                clearTimeout(newLineTimeoutRef.current);
            }
            // Abort any in-flight fetch to prevent state updates after unmount
            abortControllerRef.current?.abort();
        };
    }, [callId, fetchCall]);

    // Auto-scroll to bottom when new transcript arrives
    useEffect(() => {
        if (autoScroll && transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [call?.transcript, autoScroll]);

    const handleEndCall = async () => {
        setEnding(true);
        try {
            const endProvider = call?.provider || providerProp;
            const response = await fetch(`/api/calls/${callId}/end?provider=${endProvider}`, { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to end call');
            }
            toast.success('Call ended');
            router.push('/live');
        } catch (err) {
            console.error('Failed to end call:', err);
            toast.error('Failed to end call. Please try again.');
        } finally {
            setEnding(false);
        }
    };

    const isVapiCall = call?.provider === 'vapi' && call?.is_active;

    const handleToggleMute = async () => {
        if (!call) return;
        setTogglingMute(true);
        try {
            const action = isMuted ? 'unmute' : 'mute';
            const response = await fetch(`/api/calls/${callId}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            if (!response.ok) {
                throw new Error('Failed to toggle mute');
            }
            setIsMuted(!isMuted);
            toast.success(isMuted ? 'AI unmuted' : 'AI muted', {
                description: isMuted
                    ? 'The AI agent will resume speaking'
                    : 'The AI agent is now silent. You can type messages for it to say.',
            });
        } catch {
            toast.error('Failed to toggle mute');
        } finally {
            setTogglingMute(false);
        }
    };

    const handleSayMessage = async () => {
        if (!call || !sayMessage.trim()) return;
        setSendingSay(true);
        try {
            const response = await fetch(`/api/calls/${callId}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'say', message: sayMessage.trim() }),
            });
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            toast.success('Message sent', {
                description: 'The AI will speak your message to the caller',
            });
            setSayMessage('');
        } catch {
            toast.error('Failed to send message');
        } finally {
            setSendingSay(false);
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
                    <PhoneOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                                <AlertCircle className="h-8 w-8 text-gray-400" />
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
                                    {lastUpdateInfo && call.is_active && (
                                        <span className={`flex items-center gap-1 text-xs ${lastUpdateInfo.source === 'realtime' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                            {lastUpdateInfo.source === 'realtime' ? (
                                                <Zap className="h-3 w-3" />
                                            ) : (
                                                <RotateCw className="h-3 w-3" />
                                            )}
                                            via {lastUpdateInfo.source}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        {call.is_active && (
                            <Button
                                variant="destructive"
                                onClick={() => setShowEndConfirm(true)}
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

            {/* Vapi Call Control Panel — only visible for active Vapi calls */}
            {isVapiCall && (
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-blue-500" />
                                <span className="font-medium text-sm">Call Control</span>
                                <Badge variant="outline" className="text-xs">Vapi</Badge>
                            </div>
                            <Button
                                variant={isMuted ? 'destructive' : 'outline'}
                                size="sm"
                                onClick={handleToggleMute}
                                disabled={togglingMute}
                            >
                                {togglingMute ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isMuted ? (
                                    <>
                                        <MicOff className="h-4 w-4 mr-2" />
                                        AI Muted — Click to Unmute
                                    </>
                                ) : (
                                    <>
                                        <Mic className="h-4 w-4 mr-2" />
                                        Mute AI
                                    </>
                                )}
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={sayMessage}
                                onChange={(e) => setSayMessage(e.target.value)}
                                placeholder={isMuted
                                    ? 'Type a message for the AI to speak...'
                                    : 'Type a message for the AI to speak (overrides current response)...'
                                }
                                maxLength={500}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSayMessage();
                                    }
                                }}
                                disabled={sendingSay || togglingMute}
                            />
                            <Button
                                onClick={handleSayMessage}
                                disabled={sendingSay || togglingMute || !sayMessage.trim()}
                                size="sm"
                            >
                                {sendingSay ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Say
                                    </>
                                )}
                            </Button>
                        </div>
                        {isMuted && (
                            <p className="text-xs text-muted-foreground mt-2">
                                The AI is muted. Type messages above and they will be spoken to the caller.
                                The transcript will continue updating in real-time below.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Live Transcript */}
            <Card className="flex flex-col h-[500px]">
                <CardHeader className="flex-none flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        Live Transcript
                        {call.is_active && (
                            <span className="text-xs font-normal text-green-600 dark:text-green-400">
                                (live)
                            </span>
                        )}
                    </CardTitle>
                    <label htmlFor="auto-scroll-toggle" className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            id="auto-scroll-toggle"
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
                        role="log"
                        aria-live="polite"
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
                                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                            {line.speaker === 'agent' ? (
                                                <Bot className="h-4 w-4" />
                                            ) : (
                                                <User className="h-4 w-4" />
                                            )}
                                        </div>
                                        <div className={`flex-1 max-w-[80%] rounded-lg p-3 ${line.speaker === 'agent'
                                            ? 'bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                                            : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                                            } ${line.isNew ? 'ring-2 ring-green-400 ring-opacity-50' : ''}`}>
                                            <p className="text-sm">{line.text}</p>
                                        </div>
                                    </div>
                                ))}

                                {/* Typing indicator */}
                                {isTyping && call.is_active && (
                                    <div className="flex gap-3 animate-in fade-in">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                            <Bot className="h-4 w-4" />
                                        </div>
                                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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

            <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
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
                                setShowEndConfirm(false);
                                handleEndCall();
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
