import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    databaseError,
    validationError,
    apiSuccess,
    noContent,
    withErrorHandling,
} from '@/lib/api/response';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id } = await context!.params;
    const supabase = await createClient();

    const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (error || !client) {
        return notFound('Client');
    }

    // Mask API keys — never return raw keys to the frontend
    const masked = { ...client };
    const API_KEY_FIELDS = ['retell_api_key', 'vapi_api_key', 'bland_api_key'] as const;
    for (const k of API_KEY_FIELDS) {
        if (masked[k]) {
            masked[k] = '...' + (masked[k] as string).slice(-4);
        }
    }

    return apiSuccess(masked);
});

export const PATCH = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id } = await context!.params;
    const body = await request.json();
    const supabase = await createClient();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.branding !== undefined) updateData.branding = body.branding;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.billing_type !== undefined) updateData.billing_type = body.billing_type;
    if (body.billing_amount_cents !== undefined) updateData.billing_amount_cents = body.billing_amount_cents;
    // stripe_subscription_id is managed by Stripe webhooks only — not writable via API
    if (body.next_billing_date !== undefined) updateData.next_billing_date = body.next_billing_date;

    // Voice provider API keys (per-client override — null/empty clears the key)
    const API_KEY_MAX_LENGTH = 256;
    const API_KEY_PATTERN = /^[a-zA-Z0-9_\-:.]+$/;

    for (const keyField of ['retell_api_key', 'vapi_api_key', 'bland_api_key'] as const) {
        if (body[keyField] !== undefined) {
            if (body[keyField] === '' || body[keyField] === null) {
                updateData[keyField] = null; // Clear the key → fall back to agency key
            } else {
                if (typeof body[keyField] !== 'string' || body[keyField].length > API_KEY_MAX_LENGTH) {
                    return validationError(`${keyField} is too long (max ${API_KEY_MAX_LENGTH} chars)`);
                }
                if (!API_KEY_PATTERN.test(body[keyField])) {
                    return validationError(`${keyField} has an invalid format`);
                }
                updateData[keyField] = body[keyField];
            }
        }
    }

    const { data: client, error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .select()
        .single();

    if (error) {
        return databaseError(error);
    }

    if (!client) {
        return notFound('Client');
    }

    // Mask API keys — never return raw keys to the frontend
    const masked = { ...client };
    const KEY_FIELDS = ['retell_api_key', 'vapi_api_key', 'bland_api_key'] as const;
    for (const k of KEY_FIELDS) {
        if (masked[k]) {
            masked[k] = '...' + (masked[k] as string).slice(-4);
        }
    }

    return apiSuccess(masked);
});

export const DELETE = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id } = await context!.params;
    const supabase = await createClient();

    const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .eq('agency_id', user.agency.id);

    if (error) {
        return databaseError(error);
    }

    return noContent();
});
