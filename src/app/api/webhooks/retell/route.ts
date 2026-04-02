/**
 * Retell Webhook Route — thin wrapper
 *
 * Delegates parsing to the Retell adapter, then runs the shared webhook handler.
 * Provider-specific logic (payload types, event filtering, signature verification,
 * transcript/transfer/analysis handlers) lives in lib/webhooks/adapters/retell.ts.
 */

import { NextRequest } from 'next/server';
import { parseRetellWebhook } from '@/lib/webhooks/adapters/retell';
import { handleWebhookEvent } from '@/lib/webhooks/handler';

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const output = parseRetellWebhook(rawBody, request.headers);
    return handleWebhookEvent(output);
}
