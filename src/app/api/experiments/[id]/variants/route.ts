import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
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
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'experiments', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        const { id: experimentId } = await params;
        if (!isValidUuid(experimentId)) {
            return NextResponse.json({ error: 'Invalid experiment ID format' }, { status: 400 });
        }
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const { name, prompt, traffic_weight, is_control } = bodyOrError;

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

        // Enforce max 10 variants
        const { count: existingCount } = await supabase
            .from('experiment_variants')
            .select('id', { count: 'exact', head: true })
            .eq('experiment_id', experimentId);

        if ((existingCount || 0) >= 10) {
            return NextResponse.json({ error: 'Maximum 10 variants per experiment' }, { status: 400 });
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
// Supports: updating existing variants, inserting new variants, and deleting removed variants
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

        const { id: experimentId } = await params;
        if (!isValidUuid(experimentId)) {
            return NextResponse.json({ error: 'Invalid experiment ID format' }, { status: 400 });
        }
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const { variants } = bodyOrError;

        if (!variants || !Array.isArray(variants)) {
            return NextResponse.json({ error: 'Variants array is required' }, { status: 400 });
        }

        if (variants.length < 2) {
            return NextResponse.json({ error: 'At least 2 variants are required' }, { status: 400 });
        }

        if (variants.length > 10) {
            return NextResponse.json({ error: 'Maximum 10 variants per experiment' }, { status: 400 });
        }

        // Validate individual variant fields and total weight
        let totalWeight = 0;
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
            totalWeight += variant.traffic_weight ?? 0;
        }

        if (Math.abs(totalWeight - 100) > 0.01) {
            return NextResponse.json({
                error: `Total traffic weight must equal 100% (currently ${totalWeight}%)`
            }, { status: 400 });
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

        if (experiment.status === 'running') {
            return NextResponse.json({
                error: 'Cannot modify variants while the experiment is running. Pause it first.'
            }, { status: 400 });
        }

        // Fetch existing variant IDs from DB to determine which to delete
        const { data: existingVariants } = await supabase
            .from('experiment_variants')
            .select('id')
            .eq('experiment_id', experimentId);

        const existingIds = new Set((existingVariants || []).map(v => v.id));

        // Separate variants into: existing (update), new (insert)
        // A variant is "existing" only if its ID is a valid UUID AND exists in the DB
        const toUpdate: typeof variants = [];
        const toInsert: typeof variants = [];

        for (const variant of variants) {
            if (variant.id && isValidUuid(variant.id) && existingIds.has(variant.id)) {
                toUpdate.push(variant);
            } else {
                toInsert.push(variant);
            }
        }

        // Determine which existing variants were removed (not in the incoming list)
        const incomingIds = new Set(toUpdate.map(v => v.id));
        const toDeleteIds = [...existingIds].filter(id => !incomingIds.has(id));

        const errors: string[] = [];

        // Delete removed variants (only if experiment is not running to preserve data)
        if (toDeleteIds.length > 0) {
            if (experiment.status === 'running') {
                return NextResponse.json({
                    error: 'Cannot delete variants from a running experiment. Pause it first.'
                }, { status: 400 });
            }

            const { error: deleteErr } = await supabase
                .from('experiment_variants')
                .delete()
                .in('id', toDeleteIds)
                .eq('experiment_id', experimentId);

            if (deleteErr) errors.push(deleteErr.code);
        }

        // Update existing variants
        for (const variant of toUpdate) {
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
        }

        // Insert new variants
        for (const variant of toInsert) {
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

// DELETE /api/experiments/[id]/variants?variant_id=xxx - Delete a single variant
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'experiments', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        const { id: experimentId } = await params;
        const { searchParams } = new URL(request.url);
        const variantId = searchParams.get('variant_id');

        if (!variantId || !isValidUuid(variantId)) {
            return NextResponse.json({ error: 'Valid variant_id is required' }, { status: 400 });
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
            return NextResponse.json({ error: 'Cannot delete variants from a running experiment' }, { status: 400 });
        }

        // Check we won't go below 2 variants
        const { count } = await supabase
            .from('experiment_variants')
            .select('id', { count: 'exact', head: true })
            .eq('experiment_id', experimentId);

        if ((count || 0) <= 2) {
            return NextResponse.json({ error: 'Cannot delete: experiment must have at least 2 variants' }, { status: 400 });
        }

        const { error } = await supabase
            .from('experiment_variants')
            .delete()
            .eq('id', variantId)
            .eq('experiment_id', experimentId);

        if (error) {
            console.error('Error deleting variant:', error.code);
            return NextResponse.json({ error: 'Failed to delete variant' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting variant:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
