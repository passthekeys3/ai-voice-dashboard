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
    withErrorHandling,
} from '@/lib/api/response';

export const GET = withErrorHandling(async () => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    const supabase = await createClient();

    // Agency users see all agents, client users see only their agents
    let query = supabase
        .from('agents')
        .select('*, clients(name)')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    if (!isAgencyAdmin(user) && user.client) {
        query = query.eq('client_id', user.client.id);
    }

    const { data: agents, error } = await query;

    if (error) {
        return databaseError(error);
    }

    return apiSuccess(agents);
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
    const { name, provider, external_id, client_id, config } = body;

    // Validate required fields
    const validationError = validateRequest([
        { field: 'name', value: name, required: true, type: 'string', minLength: 1, maxLength: 100 },
        { field: 'provider', value: provider, required: true, type: 'string', custom: (v) =>
            ['retell', 'vapi', 'bland'].includes(v as string) ? null : 'provider must be retell, vapi, or bland'
        },
        { field: 'external_id', value: external_id, required: true, type: 'string' },
    ]);

    if (validationError) {
        return validationError;
    }

    const supabase = await createClient();

    const { data: agent, error } = await supabase
        .from('agents')
        .insert({
            agency_id: user.agency.id,
            client_id: client_id || null,
            name,
            provider,
            external_id,
            config: config || {},
        })
        .select()
        .single();

    if (error) {
        return databaseError(error);
    }

    return created(agent);
});
