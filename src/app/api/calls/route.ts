import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    databaseError,
    apiSuccessPaginated,
    withErrorHandling,
} from '@/lib/api/response';

export const GET = withErrorHandling(async (request: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const clientId = searchParams.get('client_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = await createClient();

    // Get agent IDs for this agency first
    const { data: agentIds } = await supabase
        .from('agents')
        .select('id')
        .eq('agency_id', user.agency.id);

    let query = supabase
        .from('calls')
        .select('*, agents(name, provider)', { count: 'exact' })
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

    // Filter by agency through agents table
    // SECURITY: If no agents exist, return empty result to prevent unscoped query
    if (!agentIds || agentIds.length === 0) {
        return apiSuccessPaginated([], {
            total: 0,
            page: 1,
            perPage: limit,
            totalPages: 0,
        });
    }
    query = query.in('agent_id', agentIds.map(a => a.id));

    // Client users only see their calls
    if (!isAgencyAdmin(user) && user.client) {
        query = query.eq('client_id', user.client.id);
    } else if (clientId) {
        // Validate that the requested client_id belongs to this agency
        const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('id', clientId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!client) {
            // Silently ignore invalid client_id filter instead of exposing it doesn't exist
            // This prevents enumeration attacks
        } else {
            query = query.eq('client_id', clientId);
        }
    }

    if (agentId) {
        // Validate that the requested agent_id belongs to this agency
        const agentExists = agentIds?.some(a => a.id === agentId);
        if (agentExists) {
            query = query.eq('agent_id', agentId);
        }
        // Silently ignore invalid agent_id to prevent enumeration
    }

    if (status) {
        query = query.eq('status', status);
    }

    // Date range filter
    if (dateFrom) {
        query = query.gte('started_at', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
        query = query.lte('started_at', `${dateTo}T23:59:59.999Z`);
    }

    // Text search across phone numbers, status, agent name, and transcript
    if (search) {
        // Find agents matching the search term (for agent name search)
        const matchingAgentIds = agentIds
            ? (await supabase
                .from('agents')
                .select('id')
                .eq('agency_id', user.agency.id)
                .ilike('name', `%${search}%`)
              ).data?.map(a => a.id) || []
            : [];

        if (matchingAgentIds.length > 0) {
            query = query.or(`from_number.ilike.%${search}%,to_number.ilike.%${search}%,status.ilike.%${search}%,transcript.ilike.%${search}%,agent_id.in.(${matchingAgentIds.join(',')})`);
        } else {
            query = query.or(`from_number.ilike.%${search}%,to_number.ilike.%${search}%,status.ilike.%${search}%,transcript.ilike.%${search}%`);
        }
    }

    const { data: calls, error, count } = await query;

    if (error) {
        return databaseError(error);
    }

    return apiSuccessPaginated(calls || [], {
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        perPage: limit,
        totalPages: Math.ceil((count || 0) / limit),
    });
});
