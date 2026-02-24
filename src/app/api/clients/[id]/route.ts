import { NextRequest } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
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

    // Verify client exists and belongs to this agency
    const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (!client) {
        return notFound('Client');
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
