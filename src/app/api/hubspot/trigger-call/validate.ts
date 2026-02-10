/**
 * HubSpot Trigger Webhook Validation
 *
 * HMAC-SHA256 signature verification and payload schema validation
 * for inbound HubSpot workflow webhook triggers.
 */

import crypto from 'crypto';
import { z } from 'zod';

/**
 * Zod schema for HubSpot trigger webhook payload
 */
export const hubspotTriggerSchema = z.object({
    portal_id: z.string().min(1, 'portal_id is required'),
    phone_number: z.string().min(1, 'phone_number is required'),
    contact_id: z.string().optional(),
    contact_name: z.string().optional(),
    agent_id: z.string().uuid().optional(),
    from_number: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid from_number format').optional(),
    metadata: z.record(z.string(), z.unknown()).optional().refine(
        (val) => !val || JSON.stringify(val).length <= 10000,
        { message: 'metadata exceeds maximum size (10KB)' }
    ),
    scheduled_at: z.string().datetime().optional(),
});

export type HubSpotTriggerPayload = z.infer<typeof hubspotTriggerSchema>;

/**
 * Verify HubSpot webhook signature (v3).
 *
 * HubSpot v3 signature is HMAC-SHA256 of:
 * {clientSecret}{method}{url}{body}{timestamp}
 *
 * Headers: X-HubSpot-Signature-v3, X-HubSpot-Request-Timestamp
 */
export function verifyHubSpotTriggerSignature(
    rawBody: string,
    signature: string | null,
    timestamp: string | null,
    clientSecret: string,
    method: string,
    url: string,
): boolean {
    if (!signature || !clientSecret || !timestamp) return false;

    try {
        // Validate timestamp is within 5 minutes
        const requestTimestamp = parseInt(timestamp, 10);
        const now = Date.now();
        if (isNaN(requestTimestamp) || Math.abs(now - requestTimestamp) > 5 * 60 * 1000) {
            console.warn('HubSpot webhook timestamp outside 5-minute window');
            return false;
        }

        const sourceString = clientSecret + method + url + rawBody + timestamp;
        const expectedHash = crypto
            .createHmac('sha256', clientSecret)
            .update(sourceString)
            .digest('base64');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedHash),
        );
    } catch {
        return false;
    }
}

/**
 * Validate and parse HubSpot trigger payload.
 *
 * Also normalizes the phone number to E.164 format.
 */
export function validateHubSpotTriggerPayload(body: unknown): {
    success: boolean;
    data?: HubSpotTriggerPayload;
    error?: string;
} {
    const result = hubspotTriggerSchema.safeParse(body);

    if (!result.success) {
        const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return { success: false, error: errors.join(', ') };
    }

    // Normalize phone number
    let phone = result.data.phone_number.replace(/[\s\-\(\)]/g, '');
    if (!phone.startsWith('+')) {
        // Assume US/Canada if no country code
        if (phone.length === 10) {
            phone = '+1' + phone;
        } else if (phone.length === 11 && phone.startsWith('1')) {
            phone = '+' + phone;
        }
    }

    // Validate E.164 format
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
        return { success: false, error: 'Invalid phone number format. Expected E.164 (e.g., +14155551234)' };
    }

    return {
        success: true,
        data: { ...result.data, phone_number: phone },
    };
}
