/**
 * Vapi Webhook Route — thin wrapper
 *
 * Delegates parsing to the Vapi adapter, then runs the shared webhook handler.
 * Provider-specific logic (payload types, event filtering, HMAC verification,
 * live transcript RPC handler) lives in lib/webhooks/adapters/vapi.ts.
 */

import { NextRequest } from 'next/server';
import { parseVapiWebhook } from '@/lib/webhooks/adapters/vapi';
import { handleWebhookEvent } from '@/lib/webhooks/handler';

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const output = parseVapiWebhook(rawBody, request.headers);
    return handleWebhookEvent(output);
}
