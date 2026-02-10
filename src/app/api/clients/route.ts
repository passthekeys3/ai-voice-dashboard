import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    databaseError,
    apiSuccess,
    created,
    validateRequest,
    badRequest,
    withErrorHandling,
} from '@/lib/api/response';
import { VALID_BILLING_TYPES } from '@/lib/constants/config';

export const GET = withErrorHandling(async () => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const supabase = await createClient();

    const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    if (error) {
        return databaseError(error);
    }

    return apiSuccess(clients);
});

export const POST = withErrorHandling(async (request: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const body = await request.json();
    const { name, email, branding, billing_type, billing_amount_cents } = body;

    // Validate required fields
    const validationError = validateRequest([
        { field: 'name', value: name, required: true, type: 'string', minLength: 1, maxLength: 100 },
        { field: 'email', value: email, required: true, type: 'email' },
    ]);

    if (validationError) {
        return validationError;
    }

    // Validate billing fields if provided
    if (billing_type !== null && billing_type !== undefined) {
        if (!VALID_BILLING_TYPES.includes(billing_type)) {
            return badRequest(`Invalid billing type. Must be one of: ${VALID_BILLING_TYPES.join(', ')}`);
        }
    }

    if (billing_amount_cents !== null && billing_amount_cents !== undefined) {
        if (typeof billing_amount_cents !== 'number' || billing_amount_cents < 0) {
            return badRequest('Billing amount must be a non-negative number');
        }
    }

    // If billing_type is set, require billing_amount_cents
    if (billing_type && (billing_amount_cents === null || billing_amount_cents === undefined)) {
        return badRequest('Billing amount is required when billing type is set');
    }

    // Auto-generate slug from name
    const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Add random suffix to ensure uniqueness
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const supabase = await createClient();

    // Build insert data
    const insertData: Record<string, unknown> = {
        agency_id: user.agency.id,
        name,
        email,
        slug,
        branding: branding || {},
    };

    // Add billing fields if provided
    if (billing_type) {
        insertData.billing_type = billing_type;
        insertData.billing_amount_cents = billing_amount_cents;
    }

    const { data: client, error } = await supabase
        .from('clients')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        return databaseError(error);
    }

    return created(client);
});
