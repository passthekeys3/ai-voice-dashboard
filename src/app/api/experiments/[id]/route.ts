import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { safeParseJson, isValidUuid } from '@/lib/validation';
import { computeVariantMetrics, computeSignificance } from '@/lib/experiments/metrics';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/experiments/[id] - Get experiment with variants and metrics
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can view experiments
        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ---- Tier gate: Experiments require Growth+ ----
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'experiments', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = await createClient();

        // Fetch experiment with variants
        const { data: experiment, error } = await supabase
            .from('experiments')
            .select('*, agent:agents(name), variants:experiment_variants(*)')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (error || !experiment) {
            return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        }

        // Fetch call metrics per variant using shared computation
        if (experiment.variants && experiment.variants.length > 0) {
            const { data: agencyAgents } = await supabase
                .from('agents')
                .select('id')
                .eq('agency_id', user.agency.id);
            const agencyAgentIds = agencyAgents?.map(a => a.id) || [];

            const variantCallsMap: Record<string, { duration_seconds?: number; sentiment?: string; status?: string }[]> = {};

            for (const variant of experiment.variants) {
                let query = supabase
                    .from('calls')
                    .select('duration_seconds, sentiment, status')
                    .eq('variant_id', variant.id);

                if (agencyAgentIds.length > 0) {
                    query = query.in('agent_id', agencyAgentIds);
                }

                const { data: calls } = await query;
                variantCallsMap[variant.id] = calls || [];

                const metrics = computeVariantMetrics(calls || []);
                Object.assign(variant, metrics);
            }

            // Compute statistical significance between top 2 variants
            if (experiment.variants.length >= 2) {
                const sorted = [...experiment.variants].sort((a, b) => {
                    const goal = experiment.goal || 'conversion';
                    const metricKey = goal === 'conversion' ? 'conversion_rate' : goal === 'duration' ? 'avg_duration' : 'avg_sentiment';
                    return (b[metricKey] || 0) - (a[metricKey] || 0);
                });

                const topTwo = sorted.slice(0, 2);
                const confidence = computeSignificance(
                    experiment.goal || 'conversion',
                    { calls: variantCallsMap[topTwo[0].id] || [], metrics: topTwo[0] },
                    { calls: variantCallsMap[topTwo[1].id] || [], metrics: topTwo[1] },
                );

                // Attach confidence to the experiment object
                experiment.confidence = confidence;
            }
        }

        return NextResponse.json({ data: experiment });
    } catch (error) {
        console.error('Error fetching experiment:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/experiments/[id] - Update experiment
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ---- Tier gate: Experiments require Growth+ ----
        const patchTierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'experiments', user.agency.beta_ends_at);
        if (patchTierError) {
            return NextResponse.json({ error: patchTierError }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const body = bodyOrError;
        const supabase = await createClient();

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.goal !== undefined) updateData.goal = body.goal;
        if (body.status !== undefined) {
            const ALLOWED_STATUSES = ['draft', 'running', 'completed', 'paused'];
            if (!ALLOWED_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }

            // Guard: prevent multiple running experiments for the same agent
            if (body.status === 'running') {
                // First fetch this experiment to get its agent_id
                const { data: thisExp } = await supabase
                    .from('experiments')
                    .select('agent_id')
                    .eq('id', id)
                    .eq('agency_id', user.agency.id)
                    .single();

                if (thisExp) {
                    const { data: runningExps } = await supabase
                        .from('experiments')
                        .select('id, name')
                        .eq('agent_id', thisExp.agent_id)
                        .eq('agency_id', user.agency.id)
                        .eq('status', 'running')
                        .neq('id', id)
                        .limit(1);

                    if (runningExps && runningExps.length > 0) {
                        return NextResponse.json({
                            error: `Another experiment ("${runningExps[0].name}") is already running for this agent. Pause or complete it first.`
                        }, { status: 409 });
                    }
                }
            }

            updateData.status = body.status;
            if (body.status === 'running' && !body.start_date) {
                updateData.start_date = new Date().toISOString();
            }
            if (body.status === 'completed' && !body.end_date) {
                updateData.end_date = new Date().toISOString();
            }
        }
        if (body.winner_variant_id !== undefined) updateData.winner_variant_id = body.winner_variant_id;

        const { data: experiment, error } = await supabase
            .from('experiments')
            .update(updateData)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .select('*, agent:agents(name), variants:experiment_variants(*)')
            .single();

        if (error) {
            console.error('Error updating experiment:', error.code);
            return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
        }

        return NextResponse.json({ data: experiment });
    } catch (error) {
        console.error('Error updating experiment:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/experiments/[id] - Delete experiment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ---- Tier gate: Experiments require Growth+ ----
        const deleteTierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'experiments', user.agency.beta_ends_at);
        if (deleteTierError) {
            return NextResponse.json({ error: deleteTierError }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = await createClient();

        // Only allow deleting draft or completed experiments
        const { data: experiment } = await supabase
            .from('experiments')
            .select('status')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!experiment) {
            return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        }

        if (experiment.status === 'running') {
            return NextResponse.json({ error: 'Cannot delete a running experiment. Pause it first.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('experiments')
            .delete()
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        if (error) {
            console.error('Error deleting experiment:', error.code);
            return NextResponse.json({ error: 'Failed to delete experiment' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting experiment:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
