/**
 * GHL Trigger Webhook Validation
 *
 * HMAC-SHA256 signature verification and payload schema validation
 * for inbound GoHighLevel workflow webhook triggers.
 */

import crypto from 'crypto';
import { z } from 'zod';
import { normalizePhoneToE164 } from '@/lib/validation/phone';

/**
 * Zod schema for GHL trigger webhook payload
 */
export const ghlTriggerSchema = z.object({
    location_id: z.string().min(1, 'location_id is required'),
    phone_number: z.string().min(1, 'phone_number is required'),
    contact_id: z.string().optional(),
    contact_name: z.string().optional(),
    agent_id: z.string().optional(),
    from_number: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid from_number format').optional(),
    metadata: z.record(z.string(), z.unknown()).optional().refine(
        (val) => !val || JSON.stringify(val).length <= 10000,
        { message: 'metadata exceeds maximum size (10KB)' }
    ),
    scheduled_at: z.string().datetime().optional(),
});

export type GHLTriggerPayload = z.infer<typeof ghlTriggerSchema>;

/**
 * Verify HMAC-SHA256 webhook signature.
 *
 * The signature is computed as HMAC-SHA256(webhook_secret, raw_body)
 * and sent in the x-ghl-signature header.
 */
export function verifyGHLTriggerSignature(
    rawBody: string,
    signature: string | null,
    webhookSecret: string,
): boolean {
    if (!signature || !webhookSecret) return false;

    try {
        const expectedHash = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedHash),
        );
    } catch {
        return false;
    }
}

/**
 * Validate and parse GHL trigger payload.
 *
 * Also normalizes the phone number to E.164 format.
 */
export function validateGHLTriggerPayload(body: unknown): {
    success: boolean;
    data?: GHLTriggerPayload;
    error?: string;
} {
    const result = ghlTriggerSchema.safeParse(body);

    if (!result.success) {
        const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return { success: false, error: errors.join(', ') };
    }

    const normalized = normalizePhoneToE164(result.data.phone_number);
    if ('error' in normalized) {
        return { success: false, error: normalized.error };
    }

    return {
        success: true,
        data: { ...result.data, phone_number: normalized.phone },
    };
}
