import { NextRequest } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    badRequest,
    databaseError,
    validationError,
    apiSuccess,
    noContent,
    withErrorHandling,
} from '@/lib/api/response';
import { getStripe } from '@/lib/stripe';
import { isValidUuid } from '@/lib/validation';
import { encrypt } from '@/lib/crypto';
import { maskClientApiKeys } from '@/lib/clients/mask-keys';
import { API_KEY_PATTERN, API_KEY_MAX_LENGTH } from '@/lib/integrations/validate-integrations';

// Admin client for auth user deletion (same pattern as invite route)
const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    if (!isValidUuid(id)) {
        return badRequest('Invalid ID format');
    }

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

    return apiSuccess(maskClientApiKeys(client));
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

    if (!isValidUuid(id)) {
        return badRequest('Invalid ID format');
    }

    const body = await request.json();
    const supabase = await createClient();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    // Validate name if provided
    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 200) {
            return badRequest('Name must be between 1 and 200 characters');
        }
        updateData.name = body.name.trim();
    }

    // Validate email if provided
    if (body.email !== undefined) {
        if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            return badRequest('Invalid email format');
        }
        updateData.email = body.email.toLowerCase().trim();
    }

    if (body.branding !== undefined) updateData.branding = body.branding;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Validate billing fields
    const VALID_BILLING_TYPES = ['subscription', 'per_minute', 'one_time'];
    if (body.billing_type !== undefined) {
        if (body.billing_type !== null && !VALID_BILLING_TYPES.includes(body.billing_type)) {
            return badRequest(`Invalid billing type. Must be one of: ${VALID_BILLING_TYPES.join(', ')}`);
        }
        updateData.billing_type = body.billing_type;
    }
    if (body.billing_amount_cents !== undefined) {
        if (body.billing_amount_cents !== null && (typeof body.billing_amount_cents !== 'number' || body.billing_amount_cents < 0)) {
            return badRequest('Billing amount must be a non-negative number');
        }
        updateData.billing_amount_cents = body.billing_amount_cents;
    }
    // stripe_subscription_id is managed by Stripe webhooks only — not writable via API
    if (body.next_billing_date !== undefined) updateData.next_billing_date = body.next_billing_date;

    // Voice provider API keys (per-client override — null/empty clears the key)
    for (const keyField of ['retell_api_key', 'vapi_api_key', 'vapi_public_key', 'bland_api_key'] as const) {
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
                updateData[keyField] = encrypt(body[keyField]) ?? body[keyField];
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

    return apiSuccess(maskClientApiKeys(client));
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

    if (!isValidUuid(id)) {
        return badRequest('Invalid ID format');
    }

    // Verify client exists and belongs to this agency
    const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, stripe_subscription_id')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (!client) {
        return notFound('Client');
    }

    // Cancel Stripe subscription if one exists (clients are billed via agency's Connect account)
    if (client.stripe_subscription_id && process.env.STRIPE_SECRET_KEY && user.agency.stripe_connect_account_id) {
        try {
            const stripe = getStripe();
            await stripe.subscriptions.cancel(client.stripe_subscription_id, {
                stripeAccount: user.agency.stripe_connect_account_id,
            });
        } catch (stripeErr) {
            console.error(`Failed to cancel Stripe subscription ${client.stripe_subscription_id}:`,
                stripeErr instanceof Error ? stripeErr.message : stripeErr);
            // Continue with deletion — subscription can be manually cleaned up in Stripe dashboard
        }
    }

    // Fetch all user profiles linked to this client
    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('client_id', id)
        .eq('agency_id', user.agency.id);

    // Delete all associated auth users (profile cascade-deletes automatically)
    if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
            // Skip the current user to prevent self-deletion
            if (profile.id === user.profile.id) continue;

            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
            if (authError) {
                console.error(`Failed to delete auth user ${profile.id}:`, authError.message);
                // Continue deleting other users — don't block client deletion
            }
        }
    }

    // Delete the client record (cascades: calls, usage; sets NULL: agents)
    const { error } = await supabaseAdmin
        .from('clients')
        .delete()
        .eq('id', id)
        .eq('agency_id', user.agency.id);

    if (error) {
        return databaseError(error);
    }

    return noContent();
});
