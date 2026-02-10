import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PATCH /api/test-personas/[id] - Update a custom persona
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
        const supabase = await createClient();

        // Verify persona exists and belongs to this agency
        const { data: existing } = await supabase
            .from('test_personas')
            .select('id, is_preset, agency_id')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
        }

        // Can't edit preset personas
        if (existing.is_preset) {
            return NextResponse.json({ error: 'Preset personas cannot be edited' }, { status: 403 });
        }

        // Must belong to this agency
        if (existing.agency_id !== user.agency.id) {
            return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
        }

        const body = await request.json();
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.traits !== undefined) {
            // Validate traits if provided
            const { traits } = body;
            const validTemperaments = ['angry', 'friendly', 'confused', 'impatient', 'skeptical', 'neutral'];
            const validStyles = ['verbose', 'terse', 'rambling', 'direct', 'polite'];
            const validKnowledge = ['expert', 'moderate', 'novice'];
            const validObjection = ['high', 'medium', 'low', 'none'];

            if (traits.temperament && !validTemperaments.includes(traits.temperament)) {
                return NextResponse.json({ error: 'Invalid temperament' }, { status: 400 });
            }
            if (traits.communication_style && !validStyles.includes(traits.communication_style)) {
                return NextResponse.json({ error: 'Invalid communication style' }, { status: 400 });
            }
            if (traits.knowledge_level && !validKnowledge.includes(traits.knowledge_level)) {
                return NextResponse.json({ error: 'Invalid knowledge level' }, { status: 400 });
            }
            if (traits.objection_tendency && !validObjection.includes(traits.objection_tendency)) {
                return NextResponse.json({ error: 'Invalid objection tendency' }, { status: 400 });
            }

            updateData.traits = traits;
        }

        const { data: persona, error } = await supabase
            .from('test_personas')
            .update(updateData)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating persona:', error);
            return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
        }

        return NextResponse.json({ data: persona });
    } catch (error) {
        console.error('Error updating persona:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/test-personas/[id] - Delete a custom persona
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

        // Verify persona exists and belongs to this agency
        const { data: existing } = await supabase
            .from('test_personas')
            .select('id, is_preset, agency_id')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
        }

        if (existing.is_preset) {
            return NextResponse.json({ error: 'Preset personas cannot be deleted' }, { status: 403 });
        }

        if (existing.agency_id !== user.agency.id) {
            return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
        }

        // Check if persona is referenced by any test cases
        const { count: referencingCases } = await supabase
            .from('test_cases')
            .select('id', { count: 'exact', head: true })
            .eq('persona_id', id);

        if (referencingCases && referencingCases > 0) {
            return NextResponse.json(
                { error: `Cannot delete persona: it is used by ${referencingCases} test case${referencingCases > 1 ? 's' : ''}. Remove the persona from those cases first.` },
                { status: 409 }
            );
        }

        const { error } = await supabase
            .from('test_personas')
            .delete()
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        if (error) {
            console.error('Error deleting persona:', error);
            return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting persona:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
