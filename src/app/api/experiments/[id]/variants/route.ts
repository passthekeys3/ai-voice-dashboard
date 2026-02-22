import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/experiments/[id]/variants - Add a variant
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: experimentId } = await params;
        const body = await request.json();
        const { name, prompt, traffic_weight, is_control } = body;

        if (!name || !prompt) {
            return NextResponse.json({ error: 'Name and prompt are required' }, { status: 400 });
        }

        const supabase = await createClient();

        // Verify experiment belongs to this agency and is not running
        const { data: experiment } = await supabase
            .from('experiments')
            .select('status')
            .eq('id', experimentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!experiment) {
            return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        }

        if (experiment.status === 'running') {
            return NextResponse.json({ error: 'Cannot add variants to a running experiment' }, { status: 400 });
        }

        const { data: variant, error } = await supabase
            .from('experiment_variants')
            .insert({
                experiment_id: experimentId,
                name,
                prompt,
                traffic_weight: traffic_weight || 50,
                is_control: is_control || false,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating variant:', error.code);
            return NextResponse.json({ error: 'Failed to create variant' }, { status: 500 });
        }

        return NextResponse.json({ data: variant }, { status: 201 });
    } catch (error) {
        console.error('Error creating variant:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/experiments/[id]/variants - Update variants (batch)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: experimentId } = await params;
        const body = await request.json();
        const { variants } = body;

        if (!variants || !Array.isArray(variants)) {
            return NextResponse.json({ error: 'Variants array is required' }, { status: 400 });
        }

        const supabase = await createClient();

        // Verify experiment belongs to this agency
        const { data: experiment } = await supabase
            .from('experiments')
            .select('status')
            .eq('id', experimentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!experiment) {
            return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        }

        // Update each variant
        for (const variant of variants) {
            if (variant.id) {
                // Update existing
                await supabase
                    .from('experiment_variants')
                    .update({
                        name: variant.name,
                        prompt: variant.prompt,
                        traffic_weight: variant.traffic_weight,
                        is_control: variant.is_control,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', variant.id)
                    .eq('experiment_id', experimentId);
            } else {
                // Create new
                await supabase
                    .from('experiment_variants')
                    .insert({
                        experiment_id: experimentId,
                        name: variant.name,
                        prompt: variant.prompt,
                        traffic_weight: variant.traffic_weight,
                        is_control: variant.is_control,
                    });
            }
        }

        // Fetch updated variants
        const { data: updatedVariants } = await supabase
            .from('experiment_variants')
            .select('*')
            .eq('experiment_id', experimentId)
            .order('created_at');

        return NextResponse.json({ data: updatedVariants });
    } catch (error) {
        console.error('Error updating variants:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
