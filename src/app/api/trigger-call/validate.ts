/**
 * Generic Trigger API Validation
 *
 * Payload schema validation and phone number normalization
 * for the generic /api/trigger-call endpoint used by
 * Make.com, n8n, and other automation platforms.
 */

import { z } from 'zod';

/**
 * Zod schema for generic trigger API payload
 */
export const apiTriggerSchema = z.object({
    phone_number: z.string().min(1, 'phone_number is required'),
    agent_id: z.string().uuid().optional(),
    from_number: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid from_number format').optional(),
    contact_name: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional().refine(
        (val) => !val || JSON.stringify(val).length <= 10000,
        { message: 'metadata exceeds maximum size (10KB)' }
    ),
    scheduled_at: z.string().datetime().optional(),
});

export type ApiTriggerPayload = z.infer<typeof apiTriggerSchema>;

/**
 * Validate and parse generic trigger payload.
 *
 * Also normalizes the phone number to E.164 format.
 */
export function validateApiTriggerPayload(body: unknown): {
    success: boolean;
    data?: ApiTriggerPayload;
    error?: string;
} {
    const result = apiTriggerSchema.safeParse(body);

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
