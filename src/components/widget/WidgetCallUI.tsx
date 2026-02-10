'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { RetellWebClient as BaseRetellWebClient } from 'retell-client-js-sdk';

// Extend the SDK type with methods that exist at runtime but aren't in the type definitions
interface RetellWebClient extends BaseRetellWebClient {
    muteMicrophone?: () => void;
    unmuteMicrophone?: () => void;
}

interface WidgetConfig {
    color: string;
    position: string;
    greeting: string;
    avatar_url: string | null;
}

interface WidgetCallUIProps {
    agentId: string;
    agentName: string;
    provider: string;
    widgetConfig: WidgetConfig;
}

type CallState = 'idle' | 'connecting' | 'active' | 'ended';

/**
 * WidgetCallUI — the voice call interface rendered inside the embeddable widget iframe.
 *
 * States: idle → connecting → active → ended
 * Communicates with parent window via postMessage for close/minimize/state changes.
 * Based on the TestCall.tsx pattern but standalone (no dashboard UI libraries).
 */
export function WidgetCallUI({ agentId, agentName, provider, widgetConfig }: WidgetCallUIProps) {
    const retellClientRef = useRef<RetellWebClient | null>(null);
    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [callState, setCallState] = useState<CallState>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [transcript, setTranscript] = useState<{ role: string; content: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const durationRef = useRef<NodeJS.Timeout | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    const color = widgetConfig.color || '#0f172a';

    // Notify parent window of state changes
    const postToParent = useCallback((action: string, data?: Record<string, unknown>) => {
        try {
            window.parent.postMessage(
                { type: 'prosody-widget', action, ...data },
                '*'
            );
        } catch {
            // Parent may not exist if opened directly
        }
    }, []);

    // Load Retell SDK on mount
    useEffect(() => {
        if (provider !== 'retell') return;

        const loadSDK = async () => {
            try {
                const { RetellWebClient } = await import('retell-client-js-sdk');
                retellClientRef.current = new RetellWebClient();
                setSdkLoaded(true);
            } catch (err) {
                console.log('Retell SDK loading issue:', err);
                setSdkLoaded(false);
            }
        };
        loadSDK();

        return () => {
            const client = retellClientRef.current;
            if (client) {
                client.stopCall();
                client.removeAllListeners();
            }
        };
    }, [provider]);

    // Duration timer
    useEffect(() => {
        if (callState === 'active') {
            setDuration(0);
            durationRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);
        } else {
            if (durationRef.current) {
                clearInterval(durationRef.current);
                durationRef.current = null;
            }
        }

        return () => {
            if (durationRef.current) {
                clearInterval(durationRef.current);
            }
        };
    }, [callState]);

    // Auto-scroll transcript
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const formatDuration = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const startCall = async () => {
        setCallState('connecting');
        setError(null);
        setTranscript([]);
        postToParent('call-connecting');

        try {
            // Get access token from widget session API
            const response = await fetch(`/api/widget/${agentId}/session`, {
                method: 'POST',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create call session');
            }

            const { access_token } = await response.json();

            const client = retellClientRef.current;
            if (!client) {
                setError('Voice SDK not loaded. Please refresh and try again.');
                setCallState('idle');
                return;
            }

            // Remove any stale listeners from previous calls to prevent duplicates
            client.removeAllListeners();

            // Set up event listeners
            client.on('call_started', () => {
                setCallState('active');
                postToParent('call-started');
            });

            client.on('call_ended', () => {
                setCallState('ended');
                postToParent('call-ended');
            });

            client.on('error', (err: Error) => {
                setError(err.message);
                setCallState('ended');
                postToParent('call-ended');
            });

            client.on('update', (update: { transcript?: { role: string; content: string }[] }) => {
                if (update.transcript) {
                    setTranscript(update.transcript);
                }
            });

            // Start the call
            await client.startCall({
                accessToken: access_token,
            });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start call');
            setCallState('idle');
        }
    };

    const endCall = () => {
        const client = retellClientRef.current;
        if (client) {
            client.stopCall();
        }
        setCallState('ended');
        postToParent('call-ended');
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

    const resetCall = () => {
        setCallState('idle');
        setTranscript([]);
        setError(null);
        setIsMuted(false);
        setDuration(0);
    };

    const handleClose = () => {
        if (callState === 'active') {
            endCall();
        }
        postToParent('close');
    };

    const handleMinimize = () => {
        postToParent('minimize');
    };

    // Derive lighter/darker shades from the primary color for hover states
    const colorWithOpacity = (opacity: number) => {
        // Convert hex to rgba, with fallback for invalid values
        const hex = color.replace('#', '');
        const isValidHex = /^[0-9a-fA-F]{6}$/.test(hex);
        const safeHex = isValidHex ? hex : '0f172a'; // fallback to default
        const r = parseInt(safeHex.substring(0, 2), 16);
        const g = parseInt(safeHex.substring(2, 4), 16);
        const b = parseInt(safeHex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100%',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: color,
                color: '#ffffff',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Avatar */}
                    {widgetConfig.avatar_url ? (
                        <img
                            src={widgetConfig.avatar_url}
                            alt={agentName}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid rgba(255,255,255,0.3)',
                            }}
                        />
                    ) : (
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 600,
                        }}>
                            {agentName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.2' }}>
                            {agentName}
                        </div>
                        {callState === 'active' && (
                            <div style={{ fontSize: '12px', opacity: 0.8, lineHeight: '1.2' }}>
                                {formatDuration(duration)}
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={handleMinimize}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '18px',
                            opacity: 0.8,
                            lineHeight: 1,
                        }}
                        aria-label="Minimize"
                    >
                        &#8211;
                    </button>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '18px',
                            opacity: 0.8,
                            lineHeight: 1,
                        }}
                        aria-label="Close"
                    >
                        &#x2715;
                    </button>
                </div>
            </div>

            {/* Body */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* IDLE STATE */}
                {callState === 'idle' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '32px 24px',
                        gap: '20px',
                    }}>
                        {/* Agent Avatar (large) */}
                        {widgetConfig.avatar_url ? (
                            <img
                                src={widgetConfig.avatar_url}
                                alt={agentName}
                                style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: `3px solid ${color}`,
                                }}
                            />
                        ) : (
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                backgroundColor: colorWithOpacity(0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '32px',
                                fontWeight: 600,
                                color: color,
                            }}>
                                {agentName.charAt(0).toUpperCase()}
                            </div>
                        )}

                        <div style={{ textAlign: 'center' }}>
                            <p style={{
                                fontSize: '16px',
                                fontWeight: 500,
                                margin: '0 0 4px 0',
                                color: '#1e293b',
                            }}>
                                {widgetConfig.greeting}
                            </p>
                            <p style={{
                                fontSize: '13px',
                                margin: 0,
                                color: '#64748b',
                            }}>
                                Click below to start a voice conversation
                            </p>
                        </div>

                        <button
                            onClick={startCall}
                            disabled={!sdkLoaded && provider === 'retell'}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 28px',
                                backgroundColor: color,
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '24px',
                                fontSize: '15px',
                                fontWeight: 600,
                                cursor: sdkLoaded || provider !== 'retell' ? 'pointer' : 'not-allowed',
                                opacity: sdkLoaded || provider !== 'retell' ? 1 : 0.5,
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            }}
                        >
                            {/* Phone icon SVG */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            Start Call
                        </button>

                        {provider !== 'retell' && (
                            <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>
                                Web calls are currently only available for Retell agents.
                            </p>
                        )}
                    </div>
                )}

                {/* CONNECTING STATE */}
                {callState === 'connecting' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '32px 24px',
                        gap: '16px',
                    }}>
                        {/* Pulsing circle animation */}
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            backgroundColor: colorWithOpacity(0.15),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'pulse 1.5s ease-in-out infinite',
                        }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                backgroundColor: colorWithOpacity(0.3),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </div>
                        </div>
                        <p style={{ fontSize: '15px', fontWeight: 500, color: '#475569', margin: 0 }}>
                            Connecting...
                        </p>
                        <style>{`
                            @keyframes pulse {
                                0%, 100% { transform: scale(1); opacity: 1; }
                                50% { transform: scale(1.1); opacity: 0.7; }
                            }
                        `}</style>
                    </div>
                )}

                {/* ACTIVE STATE */}
                {callState === 'active' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        {/* Live indicator */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: '#f0fdf4',
                            borderBottom: '1px solid #e2e8f0',
                            flexShrink: 0,
                        }}>
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: '#22c55e',
                                animation: 'blink 1.5s ease-in-out infinite',
                            }} />
                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#16a34a' }}>
                                Live
                            </span>
                            <style>{`
                                @keyframes blink {
                                    0%, 100% { opacity: 1; }
                                    50% { opacity: 0.3; }
                                }
                            `}</style>
                        </div>

                        {/* Transcript area */}
                        <div style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: '12px 16px',
                        }}>
                            {transcript.length === 0 ? (
                                <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', marginTop: '24px' }}>
                                    Waiting for conversation...
                                </p>
                            ) : (
                                transcript.map((msg, i) => (
                                    <div key={i} style={{
                                        marginBottom: '10px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: msg.role === 'agent' ? 'flex-start' : 'flex-end',
                                    }}>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: msg.role === 'agent' ? color : '#16a34a',
                                            marginBottom: '2px',
                                        }}>
                                            {msg.role === 'agent' ? agentName : 'You'}
                                        </span>
                                        <div style={{
                                            backgroundColor: msg.role === 'agent' ? '#f1f5f9' : colorWithOpacity(0.08),
                                            padding: '8px 12px',
                                            borderRadius: msg.role === 'agent' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                                            fontSize: '13px',
                                            lineHeight: '1.4',
                                            color: '#334155',
                                            maxWidth: '85%',
                                        }}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={transcriptEndRef} />
                        </div>

                        {/* Call controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '16px',
                            padding: '12px 16px',
                            borderTop: '1px solid #e2e8f0',
                            backgroundColor: '#fafafa',
                            flexShrink: 0,
                        }}>
                            <button
                                onClick={toggleMute}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: isMuted ? '#fef2f2' : '#ffffff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background-color 0.15s',
                                }}
                                aria-label={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .84-.14 1.65-.4 2.41" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                )}
                            </button>

                            <button
                                onClick={endCall}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(239,68,68,0.3)',
                                    transition: 'transform 0.15s',
                                }}
                                aria-label="End call"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                                    <line x1="23" y1="1" x2="1" y2="23" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* ENDED STATE */}
                {callState === 'ended' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '32px 24px',
                        gap: '16px',
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '15px', fontWeight: 500, color: '#1e293b', margin: '0 0 4px 0' }}>
                                Call ended
                            </p>
                            {duration > 0 && (
                                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                                    Duration: {formatDuration(duration)}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={resetCall}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 24px',
                                backgroundColor: color,
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '20px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'transform 0.15s',
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            Call Again
                        </button>
                    </div>
                )}
            </div>

            {/* Error bar */}
            {error && (
                <div style={{
                    padding: '8px 16px',
                    backgroundColor: '#fef2f2',
                    borderTop: '1px solid #fecaca',
                    fontSize: '12px',
                    color: '#dc2626',
                    textAlign: 'center',
                    flexShrink: 0,
                }}>
                    {error}
                </div>
            )}

            {/* Powered by */}
            <div style={{
                padding: '6px',
                textAlign: 'center',
                fontSize: '10px',
                color: '#94a3b8',
                borderTop: '1px solid #f1f5f9',
                flexShrink: 0,
            }}>
                Powered by Prosody
            </div>
        </div>
    );
}
