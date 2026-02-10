import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

// GET /api/test-personas - List all personas (presets + agency custom)
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();

        // Fetch presets (available to all) + agency-specific custom personas
        const { data: personas, error } = await supabase
            .from('test_personas')
            .select('*')
            .or(`is_preset.eq.true,agency_id.eq.${user.agency.id}`)
            .order('is_preset', { ascending: false })
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching personas:', error);
            return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });
        }

        return NextResponse.json({ data: personas });
    } catch (error) {
        console.error('Error fetching personas:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/test-personas - Create a custom persona
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
        const { name, description, traits } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!traits || typeof traits !== 'object') {
            return NextResponse.json({ error: 'Traits are required' }, { status: 400 });
        }

        // Validate trait fields
        const validTemperaments = ['angry', 'friendly', 'confused', 'impatient', 'skeptical', 'neutral'];
        const validStyles = ['verbose', 'terse', 'rambling', 'direct', 'polite'];
        const validKnowledge = ['expert', 'moderate', 'novice'];
        const validObjection = ['high', 'medium', 'low', 'none'];

        if (!validTemperaments.includes(traits.temperament)) {
            return NextResponse.json({ error: 'Invalid temperament' }, { status: 400 });
        }
        if (!validStyles.includes(traits.communication_style)) {
            return NextResponse.json({ error: 'Invalid communication style' }, { status: 400 });
        }
        if (!validKnowledge.includes(traits.knowledge_level)) {
            return NextResponse.json({ error: 'Invalid knowledge level' }, { status: 400 });
        }
        if (!validObjection.includes(traits.objection_tendency)) {
            return NextResponse.json({ error: 'Invalid objection tendency' }, { status: 400 });
        }

        const supabase = await createClient();

        const { data: persona, error } = await supabase
            .from('test_personas')
            .insert({
                agency_id: user.agency.id,
                name: name.trim(),
                description: description?.trim() || null,
                traits,
                is_preset: false,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating persona:', error);
            return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
        }

        return NextResponse.json({ data: persona }, { status: 201 });
    } catch (error) {
        console.error('Error creating persona:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
