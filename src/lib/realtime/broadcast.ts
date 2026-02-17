import { createServiceClient } from '@/lib/supabase/server';
import type { RealtimeEventType, RealtimeCallPayload } from '@/types/realtime';

interface BroadcastCallUpdateParams {
  agencyId: string;
  event: RealtimeEventType;
  call: RealtimeCallPayload;
}

/**
 * Broadcast a call update to all connected clients for an agency
 * Uses Supabase Realtime Broadcast via REST (httpSend) for serverless environments
 */
export async function broadcastCallUpdate({
  agencyId,
  event,
  call,
}: BroadcastCallUpdateParams): Promise<void> {
  const supabase = createServiceClient();

  const channel = supabase.channel(`agency:${agencyId}:calls`);

  try {
    // Use httpSend for REST-based delivery (no WebSocket needed in serverless)
    await channel.httpSend(event, {
      type: event,
      timestamp: new Date().toISOString(),
      payload: call,
    });
  } finally {
    await supabase.removeChannel(channel);
  }
}

/**
 * Broadcast a transcript update for a specific call
 * Used for real-time transcript streaming
 */
export async function broadcastTranscriptUpdate({
  _agencyId,
  callId,
  transcript,
}: {
  _agencyId: string;
  callId: string;
  transcript: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const channel = supabase.channel(`call:${callId}:transcript`);

  try {
    // Use httpSend for REST-based delivery (no WebSocket needed in serverless)
    await channel.httpSend('call:transcript', {
      type: 'call:transcript',
      timestamp: new Date().toISOString(),
      payload: {
        call_id: callId,
        transcript,
      },
    });
  } finally {
    await supabase.removeChannel(channel);
  }
}
