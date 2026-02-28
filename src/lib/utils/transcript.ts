import type { TranscriptLine } from '@/types/realtime';

/**
 * Parse a raw transcript string into structured entries.
 *
 * Handles the "Agent:" / "User:" prefixed format produced by Retell and
 * stored in the `calls.transcript` column. Continuation lines (lines that
 * don't start with a known prefix) are appended to the previous entry.
 */
export function parseTranscript(transcript: string): TranscriptLine[] {
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
