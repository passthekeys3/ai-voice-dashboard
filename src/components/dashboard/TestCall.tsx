'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import type { RetellWebClient as BaseRetellWebClient } from 'retell-client-js-sdk';

// Extend the SDK type with methods that exist at runtime but aren't in the type definitions
interface RetellWebClient extends BaseRetellWebClient {
    muteMicrophone?: () => void;
    unmuteMicrophone?: () => void;
}

interface TestCallProps {
    agentId: string;
    agentName: string;
}

export function TestCall({ agentId, agentName }: TestCallProps) {
    const retellClientRef = useRef<RetellWebClient | null>(null);
    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [transcript, setTranscript] = useState<{ role: string; content: string }[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Load Retell SDK on mount
    useEffect(() => {
        const loadSDK = async () => {
            try {
                const { RetellWebClient } = await import('retell-client-js-sdk');
                retellClientRef.current = new RetellWebClient();
                setSdkLoaded(true);
                console.log('[TestCall] Retell SDK loaded successfully');
            } catch (err) {
                console.error('[TestCall] Failed to load Retell SDK:', err);
                setSdkLoaded(false);
                setError('Failed to load call SDK. Please refresh the page.');
            }
        };
        loadSDK();

        // Cleanup: stop call, remove listeners, and clear timeout on unmount
        return () => {
            const client = retellClientRef.current;
            if (client) {
                client.stopCall();
                client.removeAllListeners();
            }
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
        };
    }, []);

    const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startCall = async () => {
        setIsConnecting(true);
        setError(null);
        setTranscript([]);

        try {
            // Get access token from our API
            const response = await fetch(`/api/agents/${agentId}/webcall`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create call');
            }

            const result = await response.json();
            const accessToken = result.data?.access_token || result.access_token;
            const callId = result.data?.call_id || result.call_id;

            if (!accessToken) {
                throw new Error('No access token received from server');
            }

            console.log('[TestCall] Call started, call_id:', callId);

            const client = retellClientRef.current;
            if (!client) {
                setError('Retell SDK not loaded. Please refresh the page.');
                setIsConnecting(false);
                return;
            }

            // Remove any previous listeners to avoid duplicates
            client.removeAllListeners();

            // Start connection timeout — if call_started doesn't fire within 15s, something is wrong
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = setTimeout(() => {
                if (!retellClientRef.current) return;
                console.error('[TestCall] Connection timed out after 15 seconds');
                setError('Connection timed out. Check your microphone permissions and try again.');
                setIsConnecting(false);
                try { retellClientRef.current.stopCall(); } catch { /* ignore */ }
                connectionTimeoutRef.current = null;
            }, 15000);

            // Set up event listeners (single call_started handler that also clears timeout)
            client.on('call_started', () => {
                console.log('[TestCall] Call started');
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }
                setIsCallActive(true);
                setIsConnecting(false);
            });

            client.on('call_ended', () => {
                console.log('[TestCall] Call ended');
                setIsCallActive(false);
                setIsConnecting(false);
            });

            client.on('error', (err: Error) => {
                console.error('[TestCall] SDK error:', err);
                setError(err.message || 'Call failed');
                setIsCallActive(false);
                setIsConnecting(false);
            });

            client.on('update', (update: { transcript?: { role: string; content: string }[] }) => {
                if (update.transcript) {
                    setTranscript(update.transcript);
                }
            });

            console.log('[TestCall] Starting call with Retell SDK...');
            await client.startCall({
                accessToken,
            });
            console.log('[TestCall] startCall() resolved');

        } catch (err) {
            console.error('[TestCall] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to start call');
            setIsConnecting(false);
        }
    };

    const endCall = () => {
        const client = retellClientRef.current;
        if (client) {
            client.stopCall();
        }
        setIsCallActive(false);
        setIsConnecting(false);
    };

    const toggleMute = () => {
        const client = retellClientRef.current;
        if (client) {
            if (isMuted) {
                client.unmuteMicrophone?.();
            } else {
                client.muteMicrophone?.();
            }
            setIsMuted(!isMuted);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Test Call
                </CardTitle>
                <CardDescription>
                    Make a test call to {agentName}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Controls */}
                <div className="flex items-center gap-4">
                    {!isCallActive ? (
                        <Button
                            onClick={startCall}
                            disabled={isConnecting || !sdkLoaded}
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <Phone className="mr-2 h-4 w-4" />
                                    Start Test Call
                                </>
                            )}
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={endCall}
                                variant="destructive"
                            >
                                <PhoneOff className="mr-2 h-4 w-4" />
                                End Call
                            </Button>
                            <Button
                                onClick={toggleMute}
                                variant="outline"
                            >
                                {isMuted ? (
                                    <>
                                        <MicOff className="mr-2 h-4 w-4" />
                                        Unmute
                                    </>
                                ) : (
                                    <>
                                        <Mic className="mr-2 h-4 w-4" />
                                        Mute
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Live Transcript */}
                {(isCallActive || transcript.length > 0) && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Live Transcript</p>
                        <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-2">
                            {transcript.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Waiting for conversation...
                                </p>
                            ) : (
                                transcript.map((msg, i) => (
                                    <div key={i} className="text-sm">
                                        <span className={`font-medium ${msg.role === 'agent' ? 'text-blue-600' : 'text-green-600'}`}>
                                            {msg.role === 'agent' ? 'Agent' : 'You'}:
                                        </span>{' '}
                                        <span className="text-muted-foreground">{msg.content}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Status Indicator */}
                {isCallActive && (
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm text-muted-foreground">Call in progress</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
