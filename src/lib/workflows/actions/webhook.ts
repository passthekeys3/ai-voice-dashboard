/**
 * Webhook action handler
 */

import type { WorkflowAction } from '@/types';
import type { CallData, ActionHandlerResult } from './types';

export async function handleWebhook(
    action: WorkflowAction,
    callData: CallData,
): Promise<ActionHandlerResult> {
    const url = action.config.url as string;
    if (!url) {
        return { success: false, error: 'Webhook URL not configured' };
    }

    // Validate URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        return { success: false, error: 'Invalid webhook URL' };
    }

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
        return { success: false, error: 'Webhook URL must use HTTPS in production' };
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { success: false, error: 'Webhook URL must use HTTP or HTTPS' };
    }

    // Block internal/private IPs
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]', 'metadata.google.internal', 'metadata.google'];
    if (blockedHosts.includes(hostname)) {
        return { success: false, error: 'Webhook URL cannot target internal hosts' };
    }

    // Block IPv6 private/reserved ranges (with or without brackets)
    const bareHost = hostname.replace(/^\[|\]$/g, '');
    if (bareHost.includes(':')) {
        // IPv6 address — block all private/reserved ranges
        const lowerIpv6 = bareHost.toLowerCase();
        if (lowerIpv6 === '::1' || lowerIpv6 === '::' ||
            lowerIpv6.startsWith('fe80') ||   // link-local
            lowerIpv6.startsWith('fc') ||     // unique-local (fc00::/7)
            lowerIpv6.startsWith('fd') ||     // unique-local (fc00::/7)
            lowerIpv6.startsWith('::ffff:')) { // IPv4-mapped IPv6
            return { success: false, error: 'Webhook URL cannot target private IP ranges' };
        }
    }

    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
        const [, a, b] = ipMatch.map(Number);
        // 10.0.0.0/8, 127.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
        if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0) {
            return { success: false, error: 'Webhook URL cannot target private IP ranges' };
        }
    }

    // Whitelist safe headers (reject anything not explicitly allowed)
    const ALLOWED_HEADER_PATTERNS = [
        'content-type', 'accept', 'accept-language', 'user-agent',
    ];
    const ALLOWED_HEADER_PREFIXES = ['x-webhook-', 'x-custom-'];
    const rawHeaders = (action.config.headers as Record<string, string>) || {};
    const safeHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawHeaders)) {
        const lower = key.toLowerCase();
        if (ALLOWED_HEADER_PATTERNS.includes(lower) ||
            ALLOWED_HEADER_PREFIXES.some(prefix => lower.startsWith(prefix))) {
            safeHeaders[key] = value;
        }
    }

    // Infer event from call status/direction rather than hardcoding
    const event = callData.status === 'in_progress' || callData.status === 'queued'
        ? (callData.direction === 'inbound' ? 'inbound_call_started' : 'call_started')
        : (callData.direction === 'inbound' ? 'inbound_call_ended' : 'call_ended');

    // Add timeout via AbortController
    const webhookController = new AbortController();
    const timeoutId = setTimeout(() => webhookController.abort(), 15_000);

    try {
        const response = await fetch(url, {
            method: (action.config.method as string) || 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...safeHeaders,
            },
            body: JSON.stringify({
                event,
                ...callData,
            }),
            signal: webhookController.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return { success: false, error: `Webhook returned ${response.status}` };
        }

        return { success: true };
    } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            return { success: false, error: 'Webhook request timed out' };
        }
        throw fetchError;
    }
}
