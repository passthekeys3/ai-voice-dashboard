'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  ActiveCall,
  LiveCallDetails,
  TranscriptLine,
  ConnectionStatus,
} from '@/types/realtime';

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

interface UseRealtimeCallsOptions {
  agencyId: string;
  enabled?: boolean;
}

interface UseRealtimeCallsReturn {
  activeCalls: ActiveCall[];
  connectionStatus: ConnectionStatus;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time active calls list with Supabase Realtime
 * Subscribes to call inserts/updates and filters for in_progress status
 */
export function useRealtimeCalls({
  agencyId,
  enabled = true,
}: UseRealtimeCallsOptions): UseRealtimeCallsReturn {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());

  // Fetch active calls from API (fallback/initial load)
  const fetchActiveCalls = useCallback(async () => {
    try {
      const response = await fetch('/api/calls/active');
      if (!response.ok) return;
      const result = await response.json();
      if (result.data) {
        setActiveCalls(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch active calls');
    }
  }, []);

  useEffect(() => {
    if (!enabled || !agencyId) return;

    const supabase = supabaseRef.current;

    // Initial fetch - use an async IIFE to avoid lint warning
    const doInitialFetch = async () => {
      try {
        const response = await fetch('/api/calls/active');
        if (!response.ok) return;
        const result = await response.json();
        if (result.data) {
          setActiveCalls(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch active calls');
      }
    };
    doInitialFetch();

    // Subscribe to real-time changes on the calls table
    const channel = supabase
      .channel(`calls:agency:${agencyId}`)
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
            setActiveCalls((prev) => {
              // Check if already exists
              if (prev.some((c) => c.id === newCall.id)) return prev;

              return [
                ...prev,
                {
                  id: newCall.id,
                  external_id: newCall.external_id,
                  agent_id: newCall.agent_id,
                  agent_name: 'Loading...', // Will be updated
                  status: newCall.status,
                  started_at: newCall.started_at,
                  duration_seconds: 0,
                  from_number: newCall.from_number,
                  to_number: newCall.to_number,
                  direction: newCall.direction,
                  provider: newCall.provider,
                },
              ];
            });

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
            external_id: string;
            status: string;
            duration_seconds: number;
            ended_at?: string;
          };

          // If call ended, remove from active list
          if (updatedCall.status === 'completed' || updatedCall.status === 'failed') {
            setActiveCalls((prev) => prev.filter((c) => c.id !== updatedCall.id));
          } else {
            // Update the call in the list
            setActiveCalls((prev) =>
              prev.map((c) =>
                c.id === updatedCall.id
                  ? { ...c, status: updatedCall.status, duration_seconds: updatedCall.duration_seconds }
                  : c
              )
            );
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
            error: 'Channel error',
          }));
        }
      });

    channelRef.current = channel;

    // Update duration every second for active calls
    const durationInterval = setInterval(() => {
      setActiveCalls((prev) =>
        prev.map((call) => ({
          ...call,
          duration_seconds: Math.floor(
            (Date.now() - new Date(call.started_at).getTime()) / 1000
          ),
        }))
      );
    }, 1000);

    return () => {
      clearInterval(durationInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [agencyId, enabled, fetchActiveCalls]);

  return {
    activeCalls,
    connectionStatus,
    refresh: fetchActiveCalls,
  };
}

interface UseRealtimeLiveCallOptions {
  callId: string;
  enabled?: boolean;
}

interface UseRealtimeLiveCallReturn {
  call: LiveCallDetails | null;
  connectionStatus: ConnectionStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time single call monitoring with live transcript updates
 */
export function useRealtimeLiveCall({
  callId,
  enabled = true,
}: UseRealtimeLiveCallOptions): UseRealtimeLiveCallReturn {
  const [call, setCall] = useState<LiveCallDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());
  const prevTranscriptLengthRef = useRef(0);
  const newLineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch call details from API
  const fetchCall = useCallback(async () => {
    try {
      const response = await fetch(`/api/calls/${callId}/live`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Call not found or has ended');
          setCall(null);
          return;
        }
        throw new Error('Failed to fetch call');
      }
      const result = await response.json();
      const callData = result.data;

      // Mark new transcript lines
      const newTranscript = callData.transcript || [];
      const markedTranscript = newTranscript.map(
        (line: TranscriptLine, idx: number) => ({
          ...line,
          isNew: idx >= prevTranscriptLengthRef.current,
        })
      );
      prevTranscriptLengthRef.current = newTranscript.length;

      setCall({
        ...callData,
        transcript: markedTranscript,
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch call details');
      setError('Failed to load call data');
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    if (!enabled || !callId) return;

    const supabase = supabaseRef.current;

    // Initial fetch - use an async IIFE to avoid lint warning
    const doInitialFetch = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/live`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Call not found or has ended');
            setCall(null);
            return;
          }
          throw new Error('Failed to fetch call');
        }
        const result = await response.json();
        const callData = result.data;

        // Mark new transcript lines
        const newTranscript = callData.transcript || [];
        const markedTranscript = newTranscript.map(
          (line: TranscriptLine, idx: number) => ({
            ...line,
            isNew: idx >= prevTranscriptLengthRef.current,
          })
        );
        prevTranscriptLengthRef.current = newTranscript.length;

        setCall({
          ...callData,
          transcript: markedTranscript,
        });
        setError(null);
      } catch (err) {
        console.error('Failed to fetch call details');
        setError('Failed to load call data');
      } finally {
        setLoading(false);
      }
    };
    doInitialFetch();

    // Subscribe to real-time changes for this specific call
    const channel = supabase
      .channel(`call:${callId}`)
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
            cost_cents?: number;
            summary?: string;
            sentiment?: string;
          };

          setCall((prev) => {
            if (!prev) return null;

            const newTranscript = parseTranscript(updatedCall.transcript || '');
            const markedTranscript = newTranscript.map((line, idx) => ({
              ...line,
              isNew: idx >= prevTranscriptLengthRef.current,
            }));
            prevTranscriptLengthRef.current = newTranscript.length;

            return {
              ...prev,
              status: updatedCall.status,
              duration_seconds: updatedCall.duration_seconds,
              transcript: markedTranscript,
              raw_transcript: updatedCall.transcript,
              is_active: updatedCall.status === 'in_progress',
              cost_cents: updatedCall.cost_cents,
            };
          });

          // Clear "new" flag after animation
          if (newLineTimeoutRef.current) clearTimeout(newLineTimeoutRef.current);
          newLineTimeoutRef.current = setTimeout(() => {
            setCall((prev) =>
              prev
                ? {
                    ...prev,
                    transcript: prev.transcript.map((l) => ({ ...l, isNew: false })),
                  }
                : null
            );
            newLineTimeoutRef.current = null;
          }, 1000);
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
            error: 'Channel error',
          }));
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

    // Fallback polling for transcript updates (Retell updates happen via webhook)
    // This ensures we catch updates even if realtime subscription misses them
    const pollInterval = setInterval(() => {
      setCall((prev) => {
        if (prev?.is_active) {
          fetchCall();
        }
        return prev;
      });
    }, 3000);

    return () => {
      clearInterval(durationInterval);
      clearInterval(pollInterval);
      if (newLineTimeoutRef.current) clearTimeout(newLineTimeoutRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [callId, enabled, fetchCall]);

  return {
    call,
    connectionStatus,
    loading,
    error,
    refresh: fetchCall,
  };
}
