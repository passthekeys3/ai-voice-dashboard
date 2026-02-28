import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';

const BATCH_SIZE = 1000;
const MAX_ROWS = 100000;

const CSV_SELECT = `
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
`;

const CSV_HEADERS = [
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

// CSV escape function - prevents formula injection and handles special characters
function escapeCSV(value: string | number | null | undefined): string {
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
}

interface ExportFilters {
    agentIds: string[];
    clientId?: string;
    startDate?: string;
    endDate?: string;
    agentId?: string;
}

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

        const startDate = searchParams.get('start') || undefined;
        const endDate = searchParams.get('end') || undefined;
        const agentId = searchParams.get('agent_id') || undefined;

        // Agency scope — fetch agent IDs for scoping and validation
        const { data: agentIdsData } = await supabase
            .from('agents')
            .select('id')
            .eq('agency_id', user.agency.id);
        const agentIds = agentIdsData?.map(a => a.id) || [];

        // Determine client scoping
        let clientId: string | undefined;
        if (isAgencyAdmin(user)) {
            // SECURITY: If no agents exist, return empty CSV to prevent unscoped query
            if (agentIds.length === 0) {
                return new Response(CSV_HEADERS.join(',') + '\n', {
                    headers: {
                        'Content-Type': 'text/csv',
                        'Content-Disposition': 'attachment; filename="calls-export.csv"',
                    },
                });
            }
        } else if (user.client) {
            clientId = user.client.id;
        } else {
            // Non-admin without client — no calls to export
            return new Response(CSV_HEADERS.join(',') + '\n', {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="calls-export.csv"',
                },
            });
        }

        // Validate agent_id belongs to agency
        if (agentId) {
            if (!agentIds.includes(agentId)) {
                return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
            }
        }

        const filters: ExportFilters = { agentIds, clientId, startDate, endDate, agentId };
        const encoder = new TextEncoder();

        // Stream CSV in batches to avoid building the entire file in memory
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Emit CSV header row
                    controller.enqueue(encoder.encode(CSV_HEADERS.join(',') + '\n'));

                    let offset = 0;
                    let totalFetched = 0;

                    while (totalFetched < MAX_ROWS) {
                        // Build batch query with all filters
                        let batchQuery = supabase
                            .from('calls')
                            .select(CSV_SELECT)
                            .order('started_at', { ascending: false })
                            .range(offset, offset + BATCH_SIZE - 1);

                        // Apply filters
                        batchQuery = batchQuery.in('agent_id', filters.agentIds);
                        if (filters.clientId) {
                            batchQuery = batchQuery.eq('client_id', filters.clientId);
                        }
                        if (filters.startDate) {
                            batchQuery = batchQuery.gte('started_at', filters.startDate);
                        }
                        if (filters.endDate) {
                            batchQuery = batchQuery.lte('started_at', filters.endDate);
                        }
                        if (filters.agentId) {
                            batchQuery = batchQuery.eq('agent_id', filters.agentId);
                        }

                        const { data: calls, error } = await batchQuery;

                        if (error) {
                            console.error('Error fetching batch for export:', error.code);
                            // Write an error comment row so the user knows the export is incomplete
                            controller.enqueue(encoder.encode('# ERROR: Export incomplete due to a database error\n'));
                            break;
                        }

                        if (!calls || calls.length === 0) {
                            break; // No more rows
                        }

                        // Build CSV chunk for this batch
                        const chunk = calls.map(call => {
                            const agentName = (call.agent as unknown as { name: string } | null)?.name || '';
                            const clientName = (call.client as unknown as { name: string } | null)?.name || '';

                            return [
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
                            ].join(',');
                        }).join('\n') + '\n';

                        controller.enqueue(encoder.encode(chunk));

                        totalFetched += calls.length;
                        offset += BATCH_SIZE;

                        // If we got fewer than BATCH_SIZE, we've reached the end
                        if (calls.length < BATCH_SIZE) {
                            break;
                        }
                    }

                    controller.close();
                } catch (err) {
                    console.error('Error streaming CSV export:', err instanceof Error ? err.message : 'Unknown error');
                    try {
                        controller.enqueue(encoder.encode('# ERROR: Export incomplete due to a server error\n'));
                        controller.close();
                    } catch {
                        // Controller may already be closed
                    }
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="calls-export-${new Date().toISOString().split('T')[0]}.csv"`,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });
    } catch (error) {
        console.error('Error exporting calls:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
