import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check export permission for non-admin users
        if (!isAgencyAdmin(user)) {
            const permissions = getUserPermissions(user);
            if (!permissions.can_export_calls) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const startDate = searchParams.get('start');
        const endDate = searchParams.get('end');
        const agentId = searchParams.get('agent_id');

        // Build query
        let query = supabase
            .from('calls')
            .select(`
                id,
                external_id,
                status,
                direction,
                duration_seconds,
                cost_cents,
                from_number,
                to_number,
                summary,
                sentiment,
                started_at,
                ended_at,
                agent:agents(name),
                client:clients(name)
            `)
            .order('started_at', { ascending: false });

        // Agency scope
        if (isAgencyAdmin(user)) {
            // Admin sees all calls for the agency's agents
            const { data: agentIds } = await supabase
                .from('agents')
                .select('id')
                .eq('agency_id', user.agency.id);

            // SECURITY: If no agents exist, return empty CSV to prevent unscoped query
            if (!agentIds || agentIds.length === 0) {
                const emptyHeaders = 'Date,Agent,Direction,Status,Duration,Phone,Summary\n';
                return new Response(emptyHeaders, {
                    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="calls-export.csv"' },
                });
            }
            query = query.in('agent_id', agentIds.map(a => a.id));
        } else if (user.client) {
            // Client sees only their calls
            query = query.eq('client_id', user.client.id);
        } else {
            // Non-admin without client — no calls to export
            const emptyHeaders = 'Date,Agent,Direction,Status,Duration,Phone,Summary\n';
            return new Response(emptyHeaders, {
                headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="calls-export.csv"' },
            });
        }

        // Date filters
        if (startDate) {
            query = query.gte('started_at', startDate);
        }
        if (endDate) {
            query = query.lte('started_at', endDate);
        }
        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        // Limit to prevent huge exports
        query = query.limit(10000);

        const { data: calls, error } = await query;

        if (error) {
            console.error('Error fetching calls for export:', error);
            return NextResponse.json({ error: 'Failed to export calls' }, { status: 500 });
        }

        // CSV escape function - prevents formula injection and handles special characters
        const escapeCSV = (value: string | number | null | undefined): string => {
            if (value === null || value === undefined) return '';
            const str = String(value);

            // Prevent CSV formula injection by prefixing formula characters with single quote
            // Excel formulas start with: = + - @ or tab/carriage return
            let escaped = str;
            if (/^[=+\-@\t\r]/.test(escaped)) {
                escaped = "'" + escaped;
            }

            // Escape quotes and wrap in quotes if contains special characters
            if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
                escaped = '"' + escaped.replace(/"/g, '""') + '"';
            }

            return escaped;
        };

        // Generate CSV
        const headers = [
            'Call ID',
            'Status',
            'Direction',
            'Duration (seconds)',
            'Cost ($)',
            'From Number',
            'To Number',
            'Agent',
            'Client',
            'Sentiment',
            'Summary',
            'Started At',
            'Ended At',
        ];

        const csvRows = [headers.join(',')];

        for (const call of calls || []) {
            // Handle joined relations - cast through unknown to handle Supabase type inference
            const agentName = (call.agent as unknown as { name: string } | null)?.name || '';
            const clientName = (call.client as unknown as { name: string } | null)?.name || '';

            const row = [
                escapeCSV(call.external_id || call.id),
                escapeCSV(call.status),
                escapeCSV(call.direction),
                call.duration_seconds ?? '',
                call.cost_cents != null ? (call.cost_cents / 100).toFixed(2) : '0.00',
                escapeCSV(call.from_number),
                escapeCSV(call.to_number),
                escapeCSV(agentName),
                escapeCSV(clientName),
                escapeCSV(call.sentiment),
                escapeCSV(call.summary),
                escapeCSV(call.started_at),
                escapeCSV(call.ended_at),
            ];
            csvRows.push(row.join(','));
        }

        const csv = csvRows.join('\n');

        // Return as downloadable CSV
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="calls-export-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });
    } catch (error) {
        console.error('Error exporting calls:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
