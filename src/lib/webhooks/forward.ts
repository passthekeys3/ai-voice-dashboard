/**
 * Shared webhook forwarding module.
 *
 * Centralizes outbound webhook delivery with:
 *  - HMAC-SHA256 signing (X-Prosody-Signature + X-Prosody-Timestamp)
 *  - Retry with exponential backoff (2 retries: 1s, 2s)
 *  - Delivery logging to webhook_delivery_log table
 *  - SSRF protection via isValidWebhookUrl
 */

import { isValidWebhookUrl, signWebhookPayload } from './validation';
import type { SupabaseClient } from '@supabase/supabase-js';

const WEBHOOK_FWD_TIMEOUT = 10_000; // 10 seconds
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1_000;

interface ForwardOptions {
    webhookUrl: string;
    payload: Record<string, unknown>;
    signingSecret?: string;
    agencyId: string;
    callId?: string;
    event: string;
}

/**
 * Determine if a failed request should be retried.
 * Retries on 5xx server errors, 429 rate limits, and network failures.
 */
function isRetryable(statusCode: number | null, error?: Error): boolean {
    if (error) return true; // Network / timeout errors
    if (!statusCode) return true;
    return statusCode >= 500 || statusCode === 429;
}

/**
 * Log a delivery attempt to the webhook_delivery_log table.
 */
async function logDelivery(
    supabase: SupabaseClient,
    agencyId: string,
    callId: string | undefined,
    event: string,
    webhookUrl: string,
    statusCode: number | null,
    success: boolean,
    errorMessage: string | null,
    attempt: number,
) {
    try {
        await supabase.from('webhook_delivery_log').insert({
            agency_id: agencyId,
            call_id: callId || null,
            event,
            webhook_url: webhookUrl,
            status_code: statusCode,
            success,
            error_message: errorMessage,
            attempt,
        });
    } catch (err) {
        console.error('Failed to log webhook delivery:', err instanceof Error ? err.message : 'Unknown error');
    }
}

/**
 * Forward a webhook payload to an external URL.
 *
 * Features:
 *  - SSRF validation
 *  - HMAC-SHA256 signing when signingSecret is provided
 *  - 2 retries with exponential backoff for transient failures
 *  - Delivery logging (every attempt logged)
 */
export async function forwardToWebhook(
    supabase: SupabaseClient,
    options: ForwardOptions,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const { webhookUrl, payload, signingSecret, agencyId, callId, event } = options;

    if (!isValidWebhookUrl(webhookUrl)) {
        console.error('Blocked webhook forwarding to invalid/private URL:', webhookUrl);
        await logDelivery(supabase, agencyId, callId, event, webhookUrl, null, false, 'Blocked: invalid or private URL', 1);
        return { success: false, error: 'Invalid webhook URL' };
    }

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);

    // Build headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Prosody-Webhook/1.0',
    };
    if (signingSecret) {
        const signature = signWebhookPayload(body, signingSecret, timestamp);
        headers['X-Prosody-Signature'] = signature;
        headers['X-Prosody-Timestamp'] = String(timestamp);
    }

    let lastStatusCode: number | null = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers,
                body,
                signal: AbortSignal.timeout(WEBHOOK_FWD_TIMEOUT),
            });

            lastStatusCode = response.status;
            const success = response.status >= 200 && response.status < 300;

            await logDelivery(supabase, agencyId, callId, event, webhookUrl, response.status, success, success ? null : `HTTP ${response.status}`, attempt);

            if (success) {
                return { success: true, statusCode: response.status };
            }

            // Non-retryable failure (4xx except 429)
            if (!isRetryable(response.status)) {
                return { success: false, statusCode: response.status, error: `HTTP ${response.status}` };
            }

            lastError = `HTTP ${response.status}`;
        } catch (err) {
            lastError = err instanceof Error ? err.message : 'Unknown error';
            await logDelivery(supabase, agencyId, callId, event, webhookUrl, null, false, lastError, attempt);
        }

        // Don't delay after last attempt
        if (attempt <= MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return { success: false, statusCode: lastStatusCode ?? undefined, error: lastError ?? 'Unknown error' };
}
