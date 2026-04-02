/**
 * ElevenLabs Webhook Route — thin wrapper
 *
 * Delegates parsing to the ElevenLabs adapter, then runs the shared webhook handler.
 * Provider-specific logic (payload types, conversation.ended filtering,
 * transcript flattening) lives in lib/webhooks/adapters/elevenlabs.ts.
 */

import { NextRequest } from 'next/server';
import { parseElevenLabsWebhook } from '@/lib/webhooks/adapters/elevenlabs';
import { handleWebhookEvent } from '@/lib/webhooks/handler';

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const output = parseElevenLabsWebhook(rawBody, request.headers);
    return handleWebhookEvent(output);
}
