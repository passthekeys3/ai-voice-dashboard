// Real-time WebSocket event types for live call monitoring

export type RealtimeEventType =
  | 'call:started'
  | 'call:updated'
  | 'call:ended'
  | 'call:transcript'
  | 'connection:status';

export interface RealtimeCallEvent {
  type: RealtimeEventType;
  timestamp: string;
  payload: RealtimeCallPayload;
}

export interface RealtimeCallPayload {
  call_id: string;
  external_id: string;
  agent_id: string;
  agent_name?: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  direction: 'inbound' | 'outbound';
  from_number?: string;
  to_number?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  transcript?: string;
  cost_cents?: number;
  summary?: string;
  sentiment?: string;
}

export interface TranscriptUpdate {
  call_id: string;
  transcript: TranscriptLine[];
  raw_transcript: string;
}

export interface TranscriptLine {
  speaker: 'agent' | 'user';
  text: string;
  timestamp?: string;
}

export interface ActiveCall {
  id: string;
  external_id: string;
  agent_id: string;
  agent_name: string;
  status: string;
  started_at: string;
  duration_seconds: number;
  from_number?: string;
  to_number?: string;
  direction: string;
  provider: 'retell' | 'vapi';
}

export interface LiveCallDetails extends ActiveCall {
  transcript: TranscriptLine[];
  raw_transcript?: string;
  is_active: boolean;
  cost_cents?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  reconnecting: boolean;
  error?: string;
}
