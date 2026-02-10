import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

// GET /api/experiments - List all experiments
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agent_id');
        const status = searchParams.get('status');

        // Validate agent_id belongs to this agency if provided
        if (agentId) {
            const { data: agent } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agentId)
                .eq('agency_id', user.agency.id)
                .single();

            if (!agent) {
                return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
            }
        }

        let query = supabase
            .from('experiments')
            .select(`
                *,
                agent:agents(name),
                variants:experiment_variants(*)
            `)
            .eq('agency_id', user.agency.id)
            .order('created_at', { ascending: false });

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data: experiments, error } = await query;

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch experiments' }, { status: 500 });
        }

        return NextResponse.json({ data: experiments });
    } catch (error) {
        console.error('Error fetching experiments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/experiments - Create a new experiment
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, agent_id, goal, variants } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!agent_id) {
            return NextResponse.json({ error: 'Agent is required' }, { status: 400 });
        }

        if (!variants || !Array.isArray(variants) || variants.length < 2) {
            return NextResponse.json({ error: 'At least 2 variants are required' }, { status: 400 });
        }

        // Validate traffic weights
        let totalWeight = 0;
        for (const variant of variants) {
            if (variant.traffic_weight !== undefined && variant.traffic_weight !== null) {
                if (typeof variant.traffic_weight !== 'number' ||
                    isNaN(variant.traffic_weight) ||
                    variant.traffic_weight < 0 ||
                    variant.traffic_weight > 100) {
                    return NextResponse.json({
                        error: 'Traffic weight must be a number between 0 and 100'
                    }, { status: 400 });
                }
                totalWeight += variant.traffic_weight;
            }
        }

        if (totalWeight > 100) {
            return NextResponse.json({
                error: `Total traffic weight (${totalWeight}%) cannot exceed 100%`
            }, { status: 400 });
        }

        const supabase = await createClient();

        // Verify agent belongs to this agency
        const { data: agent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agent_id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Create experiment
        const { data: experiment, error: expError } = await supabase
            .from('experiments')
            .insert({
                agency_id: user.agency.id,
                agent_id,
                name,
                description,
                goal: goal || 'conversion',
                status: 'draft',
            })
            .select()
            .single();

        if (expError) {
            console.error('Error creating experiment:', expError);
            return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
        }

        // Create variants
        const variantData = variants.map((v: { name: string; prompt: string; traffic_weight: number; is_control?: boolean }, index: number) => ({
            experiment_id: experiment.id,
            name: v.name,
            prompt: v.prompt,
            traffic_weight: v.traffic_weight,
            is_control: v.is_control || index === 0,
        }));

        const { error: varError } = await supabase
            .from('experiment_variants')
            .insert(variantData);

        if (varError) {
            console.error('Error creating variants:', varError);
            // Rollback experiment
            await supabase.from('experiments').delete().eq('id', experiment.id);
            return NextResponse.json({ error: 'Failed to create experiment variants' }, { status: 500 });
        }

        // Fetch complete experiment with variants
        const { data: fullExperiment } = await supabase
            .from('experiments')
            .select('*, agent:agents(name), variants:experiment_variants(*)')
            .eq('id', experiment.id)
            .single();

        return NextResponse.json({ data: fullExperiment }, { status: 201 });
    } catch (error) {
        console.error('Error creating experiment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
