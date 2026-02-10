import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

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

        const { id } = await params;
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

        // Fetch call metrics per variant
        if (experiment.variants && experiment.variants.length > 0) {
            for (const variant of experiment.variants) {
                const { data: calls } = await supabase
                    .from('calls')
                    .select('duration_seconds, sentiment, status')
                    .eq('variant_id', variant.id);

                if (calls && calls.length > 0) {
                    variant.call_count = calls.length;
                    variant.avg_duration = Math.round(
                        calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length
                    );

                    // Calculate sentiment score (positive=1, neutral=0.5, negative=0)
                    const sentimentScores: number[] = calls.map(c => {
                        if (c.sentiment === 'positive') return 1;
                        if (c.sentiment === 'negative') return 0;
                        return 0.5;
                    });
                    variant.avg_sentiment = Math.round(
                        sentimentScores.reduce((sum: number, s: number) => sum + s, 0) / sentimentScores.length * 100
                    ) / 100;

                    // Conversion rate = completed calls / total calls
                    const completedCalls = calls.filter(c => c.status === 'completed').length;
                    variant.conversion_rate = Math.round((completedCalls / calls.length) * 100);
                } else {
                    variant.call_count = 0;
                    variant.avg_duration = 0;
                    variant.avg_sentiment = 0;
                    variant.conversion_rate = 0;
                }
            }
        }

        return NextResponse.json({ data: experiment });
    } catch (error) {
        console.error('Error fetching experiment:', error);
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

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.goal !== undefined) updateData.goal = body.goal;
        if (body.status !== undefined) {
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
            console.error('Error updating experiment:', error);
            return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
        }

        return NextResponse.json({ data: experiment });
    } catch (error) {
        console.error('Error updating experiment:', error);
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

        const { id } = await params;
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
            console.error('Error deleting experiment:', error);
            return NextResponse.json({ error: 'Failed to delete experiment' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting experiment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
