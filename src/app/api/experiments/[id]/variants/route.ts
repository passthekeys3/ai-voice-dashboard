import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getTierFromPriceId, hasFeature } from '@/lib/billing/tiers';
import { isValidUuid, safeParseJson } from '@/lib/validation';

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

        // ---- Tier gate: Experiments require Growth+ ----
        const tierInfo = getTierFromPriceId(user.agency.subscription_price_id || '');
        if (!tierInfo || !hasFeature(tierInfo.tier, 'experiments')) {
            return NextResponse.json(
                { error: 'A/B Experiments require a Growth plan or higher. Please upgrade.' },
                { status: 403 }
            );
        }

        const { id: experimentId } = await params;
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = bodyOrError as Record<string, any>;
        const { name, prompt, traffic_weight, is_control } = body;

        if (!name || !prompt) {
            return NextResponse.json({ error: 'Name and prompt are required' }, { status: 400 });
        }

        if (prompt && prompt.length > 50000) {
            return NextResponse.json({ error: 'Prompt is too long' }, { status: 400 });
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
                traffic_weight: traffic_weight ?? 50,
                is_control: !!is_control,
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

        // ---- Tier gate: Experiments require Growth+ ----
        const patchTierInfo = getTierFromPriceId(user.agency.subscription_price_id || '');
        if (!patchTierInfo || !hasFeature(patchTierInfo.tier, 'experiments')) {
            return NextResponse.json(
                { error: 'A/B Experiments require a Growth plan or higher. Please upgrade.' },
                { status: 403 }
            );
        }

        const { id: experimentId } = await params;
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = bodyOrError as Record<string, any>;
        const { variants } = body;

        if (!variants || !Array.isArray(variants)) {
            return NextResponse.json({ error: 'Variants array is required' }, { status: 400 });
        }

        // Validate individual variant fields
        for (const variant of variants) {
            if (variant.name !== undefined && typeof variant.name !== 'string') {
                return NextResponse.json({ error: 'Variant name must be a string' }, { status: 400 });
            }
            if (variant.prompt !== undefined && typeof variant.prompt !== 'string') {
                return NextResponse.json({ error: 'Variant prompt must be a string' }, { status: 400 });
            }
            if (variant.prompt && variant.prompt.length > 50000) {
                return NextResponse.json({ error: 'Variant prompt is too long' }, { status: 400 });
            }
            if (variant.traffic_weight !== undefined && (typeof variant.traffic_weight !== 'number' || variant.traffic_weight < 0 || variant.traffic_weight > 100)) {
                return NextResponse.json({ error: 'Traffic weight must be 0-100' }, { status: 400 });
            }
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

        // Check variant count limit: existing (in DB) + new variants <= 10
        const newVariants = variants.filter((v: { id?: string }) => !v.id);
        if (newVariants.length > 0) {
            const { count: existingCount } = await supabase
                .from('experiment_variants')
                .select('id', { count: 'exact', head: true })
                .eq('experiment_id', experimentId);

            if ((existingCount || 0) + newVariants.length > 10) {
                return NextResponse.json(
                    { error: 'Maximum 10 variants per experiment' },
                    { status: 400 }
                );
            }
        }

        // Update each variant
        const errors: string[] = [];
        for (const variant of variants) {
            if (variant.id) {
                // Validate variant ID format to prevent injection
                if (!isValidUuid(variant.id)) {
                    return NextResponse.json({ error: 'Invalid variant ID format' }, { status: 400 });
                }
                const updateFields: Record<string, unknown> = {
                    updated_at: new Date().toISOString(),
                };
                if (variant.name !== undefined) updateFields.name = variant.name;
                if (variant.prompt !== undefined) updateFields.prompt = variant.prompt;
                if (variant.traffic_weight !== undefined) updateFields.traffic_weight = variant.traffic_weight;
                if (variant.is_control !== undefined) updateFields.is_control = variant.is_control;

                const { error: updateErr } = await supabase
                    .from('experiment_variants')
                    .update(updateFields)
                    .eq('id', variant.id)
                    .eq('experiment_id', experimentId);
                if (updateErr) errors.push(updateErr.code);
            } else {
                const { error: insertErr } = await supabase
                    .from('experiment_variants')
                    .insert({
                        experiment_id: experimentId,
                        name: variant.name,
                        prompt: variant.prompt,
                        traffic_weight: variant.traffic_weight ?? 50,
                        is_control: !!variant.is_control,
                    });
                if (insertErr) errors.push(insertErr.code);
            }
        }

        if (errors.length > 0) {
            console.error('Variant update errors:', errors);
            return NextResponse.json({ error: 'Some variants failed to update' }, { status: 500 });
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
