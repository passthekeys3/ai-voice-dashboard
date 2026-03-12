'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Loader2, PhoneOutgoing, CheckCircle2 } from 'lucide-react';
import type { RetellWebClient as BaseRetellWebClient } from 'retell-client-js-sdk';

// Extend the SDK type with methods that exist at runtime but aren't in the type definitions
interface RetellWebClient extends BaseRetellWebClient {
    muteMicrophone?: () => void;
    unmuteMicrophone?: () => void;
}

// Vapi SDK type (dynamically imported)
interface VapiInstance {
    start: (assistantId: string) => Promise<unknown>;
    stop: () => void;
    setMuted: (muted: boolean) => void;
    isMuted: () => boolean;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    removeAllListeners: () => void;
}

interface TestCallProps {
    agentId: string;
    agentName: string;
    provider: 'retell' | 'vapi' | 'bland';
}

export function TestCall({ agentId, agentName, provider }: TestCallProps) {
    const retellClientRef = useRef<RetellWebClient | null>(null);
    const vapiClientRef = useRef<VapiInstance | null>(null);
    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [transcript, setTranscript] = useState<{ role: string; content: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Bland outbound call state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [blandCallId, setBlandCallId] = useState<string | null>(null);
    const [blandCallStatus, setBlandCallStatus] = useState<string | null>(null);

    const isBland = provider === 'bland';
    const supportsBrowserCall = provider === 'retell' || provider === 'vapi';

    // Load the appropriate SDK on mount
    useEffect(() => {
        const loadSDK = async () => {
            try {
                if (provider === 'retell') {
                    const { RetellWebClient } = await import('retell-client-js-sdk');
                    retellClientRef.current = new RetellWebClient();
                    setSdkLoaded(true);
                } else if (provider === 'vapi') {
                    // Vapi SDK is loaded lazily when the call starts
                    // (it needs the public key which comes from the API)
                    setSdkLoaded(true);
                } else if (provider === 'bland') {
                    // Bland uses outbound phone calls — no client SDK needed
                    setSdkLoaded(true);
                }
            } catch (err) {
                console.error('[TestCall] Failed to load SDK:', err);
                setSdkLoaded(false);
                setError('Failed to load call SDK. Please refresh the page.');
            }
        };
        loadSDK();

        // Cleanup on unmount
        return () => {
            if (retellClientRef.current) {
                retellClientRef.current.stopCall();
                retellClientRef.current.removeAllListeners();
            }
            if (vapiClientRef.current) {
                vapiClientRef.current.stop();
                vapiClientRef.current.removeAllListeners();
                vapiClientRef.current = null;
            }
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
        };
    }, [provider]);

    const startRetellCall = useCallback(async () => {
        const response = await fetch(`/api/agents/${agentId}/webcall`, { method: 'POST' });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to create call');
        }

        const result = await response.json();
        const accessToken = result.data?.access_token;
        const _callId = result.data?.call_id;

        if (!accessToken) {
            throw new Error('No access token received from server');
        }

        const client = retellClientRef.current;
        if (!client) {
            throw new Error('Retell SDK not loaded. Please refresh the page.');
        }

        // Remove any previous listeners
        client.removeAllListeners();

        // Connection timeout
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = setTimeout(() => {
            if (!retellClientRef.current) return;
            console.error('[TestCall] Connection timed out after 15 seconds');
            setError('Connection timed out. Check your microphone permissions and try again.');
            setIsConnecting(false);
            try { retellClientRef.current.stopCall(); } catch { /* ignore */ }
            connectionTimeoutRef.current = null;
        }, 15000);

        // Event listeners
        client.on('call_started', () => {
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
            setIsCallActive(true);
            setIsConnecting(false);
        });

        client.on('call_ended', () => {
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

        await client.startCall({ accessToken });
    }, [agentId]);

    const startVapiCall = useCallback(async () => {
        // Get the public key and assistant ID from our API
        const response = await fetch(`/api/agents/${agentId}/webcall`, { method: 'POST' });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to create call');
        }

        const result = await response.json();
        const publicKey = result.data?.vapi_public_key;
        const assistantId = result.data?.assistant_id;

        if (!publicKey || !assistantId) {
            throw new Error('Missing Vapi public key or assistant ID. Check your Vapi settings.');
        }

        // Dynamically import and create Vapi SDK instance
        const VapiModule = await import('@vapi-ai/web');
        const VapiClass = VapiModule.default;
        const vapiClient = new VapiClass(publicKey) as VapiInstance;
        vapiClientRef.current = vapiClient;

        // Connection timeout
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = setTimeout(() => {
            console.error('[TestCall] Connection timed out after 15 seconds');
            setError('Connection timed out. Check your microphone permissions and try again.');
            setIsConnecting(false);
            try {
                vapiClientRef.current?.stop();
                vapiClientRef.current?.removeAllListeners();
                vapiClientRef.current = null;
            } catch { /* ignore */ }
            connectionTimeoutRef.current = null;
        }, 15000);

        // Event listeners
        vapiClient.on('call-start', () => {
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
            setIsCallActive(true);
            setIsConnecting(false);
        });

        vapiClient.on('call-end', () => {
            setIsCallActive(false);
            setIsConnecting(false);
        });

        vapiClient.on('error', (err: unknown) => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[TestCall] Vapi error:', errorMsg);
            setError(errorMsg || 'Call failed');
            setIsCallActive(false);
            setIsConnecting(false);
        });

        vapiClient.on('message', (message: unknown) => {
            const msg = message as { type?: string; role?: string; transcript?: string; transcriptType?: string };
            if (msg.type === 'transcript' && msg.transcriptType === 'final') {
                setTranscript(prev => [
                    ...prev,
                    {
                        role: msg.role === 'assistant' ? 'agent' : 'user',
                        content: msg.transcript || '',
                    }
                ]);
            }
        });

        // Start the call
        await vapiClient.start(assistantId);
    }, [agentId]);

    const startBlandCall = useCallback(async () => {
        if (!phoneNumber.trim()) {
            throw new Error('Please enter a phone number');
        }

        const response = await fetch(`/api/agents/${agentId}/webcall`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phoneNumber.trim() }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to initiate call');
        }

        const result = await response.json();
        setBlandCallId(result.data?.call_id || null);
        setBlandCallStatus(result.data?.status || 'queued');
        setIsCallActive(true);
    }, [agentId, phoneNumber]);

    const startCall = async () => {
        setIsConnecting(true);
        setError(null);
        setTranscript([]);
        setIsMuted(false);
        setBlandCallId(null);
        setBlandCallStatus(null);

        try {
            if (provider === 'retell') {
                await startRetellCall();
            } else if (provider === 'vapi') {
                await startVapiCall();
            } else if (provider === 'bland') {
                await startBlandCall();
                setIsConnecting(false);
            }
        } catch (err) {
            console.error('[TestCall] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to start call');
            setIsConnecting(false);
        }
    };

    const endCall = () => {
        if (provider === 'retell') {
            retellClientRef.current?.stopCall();
        } else if (provider === 'vapi') {
            vapiClientRef.current?.stop();
            vapiClientRef.current?.removeAllListeners();
            vapiClientRef.current = null;
        }
        // Bland calls can't be ended from the browser (they end when the phone hangs up)
        setIsCallActive(false);
        setIsConnecting(false);
    };

    const toggleMute = () => {
        if (provider === 'retell') {
            const client = retellClientRef.current;
            if (client) {
                if (isMuted) {
                    client.unmuteMicrophone?.();
                } else {
                    client.muteMicrophone?.();
                }
                setIsMuted(!isMuted);
            }
        } else if (provider === 'vapi') {
            const client = vapiClientRef.current;
            if (client) {
                client.setMuted(!isMuted);
                setIsMuted(!isMuted);
            }
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
                    {isBland
                        ? `Call your phone from ${agentName}`
                        : `Make a test call to ${agentName}`
                    }
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Bland: Phone number input */}
                {isBland && !isCallActive && (
                    <div className="space-y-2">
                        <Input
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            disabled={isConnecting}
                            className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Enter your phone number and the agent will call you
                        </p>
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-4">
                    {!isCallActive ? (
                        <Button
                            onClick={startCall}
                            disabled={isConnecting || !sdkLoaded || (isBland && !phoneNumber.trim())}
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isBland ? 'Calling...' : 'Connecting...'}
                                </>
                            ) : (
                                <>
                                    {isBland ? (
                                        <PhoneOutgoing className="mr-2 h-4 w-4" />
                                    ) : (
                                        <Phone className="mr-2 h-4 w-4" />
                                    )}
                                    {isBland ? 'Call My Phone' : 'Start Test Call'}
                                </>
                            )}
                        </Button>
                    ) : (
                        <>
                            {supportsBrowserCall && (
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
                            {isBland && (
                                <Button
                                    onClick={() => {
                                        setIsCallActive(false);
                                        setBlandCallId(null);
                                        setBlandCallStatus(null);
                                    }}
                                    variant="outline"
                                >
                                    Done
                                </Button>
                            )}
                        </>
                    )}
                </div>

                {/* Bland call status */}
                {isBland && isCallActive && blandCallId && (
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">
                            Call initiated ({blandCallStatus}). Your phone should ring shortly.
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Live Transcript (browser calls only) */}
                {supportsBrowserCall && (isCallActive || transcript.length > 0) && (
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

                {/* Status Indicator (browser calls only) */}
                {supportsBrowserCall && isCallActive && (
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm text-muted-foreground">Call in progress</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
