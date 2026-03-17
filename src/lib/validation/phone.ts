/**
 * Shared phone number normalization and E.164 validation.
 *
 * Used by all trigger-call validation modules (generic, GHL, HubSpot)
 * to avoid duplicating normalization logic.
 */

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Normalize a phone number string to E.164 format.
 *
 * Strips whitespace, dashes, and parentheses, then:
 *  - 10-digit numbers are assumed US/Canada (+1 prefix)
 *  - 11-digit numbers starting with 1 get a + prefix
 *
 * Returns `{ phone }` on success, `{ error }` on invalid format.
 */
export function normalizePhoneToE164(raw: string): { phone: string } | { error: string } {
    let phone = raw.replace(/[\s\-()]/g, '');

    if (!phone.startsWith('+')) {
        if (phone.length === 10) {
            phone = '+1' + phone;
        } else if (phone.length === 11 && phone.startsWith('1')) {
            phone = '+' + phone;
        }
    }

    if (!E164_REGEX.test(phone)) {
        return { error: 'Invalid phone number format. Expected E.164 (e.g., +14155551234)' };
    }

    return { phone };
}
