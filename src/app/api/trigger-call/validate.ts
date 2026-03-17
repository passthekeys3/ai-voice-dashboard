/**
 * Generic Trigger API Validation
 *
 * Payload schema validation and phone number normalization
 * for the generic /api/trigger-call endpoint used by
 * Make.com, n8n, and other automation platforms.
 */

import { z } from 'zod';
import { normalizePhoneToE164 } from '@/lib/validation/phone';

/**
 * Zod schema for generic trigger API payload
 */
export const apiTriggerSchema = z.object({
    phone_number: z.string().min(1, 'phone_number is required'),
    agent_id: z.string().optional(),
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

    const normalized = normalizePhoneToE164(result.data.phone_number);
    if ('error' in normalized) {
        return { success: false, error: normalized.error };
    }

    return {
        success: true,
        data: { ...result.data, phone_number: normalized.phone },
    };
}
