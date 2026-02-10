import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    databaseError,
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

    return apiSuccess(client);
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
    if (body.stripe_subscription_id !== undefined) updateData.stripe_subscription_id = body.stripe_subscription_id;
    if (body.next_billing_date !== undefined) updateData.next_billing_date = body.next_billing_date;

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

    return apiSuccess(client);
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
