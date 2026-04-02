/**
 * Bland AI Webhook Route — thin wrapper
 *
 * Delegates parsing to the Bland adapter, then runs the shared webhook handler.
 * Provider-specific logic (payload types, HMAC verification, voicemail detection,
 * minutes-to-seconds conversion) lives in lib/webhooks/adapters/bland.ts.
 */

import { NextRequest } from 'next/server';
import { parseBlandWebhook } from '@/lib/webhooks/adapters/bland';
import { handleWebhookEvent } from '@/lib/webhooks/handler';

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const output = parseBlandWebhook(rawBody, request.headers);
    return handleWebhookEvent(output);
}
