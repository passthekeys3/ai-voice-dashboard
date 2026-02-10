import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/voices - List available voices from Retell
export async function GET(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // Get Retell API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
        }

        // Fetch voices from Retell
        const retellResponse = await fetch('https://api.retellai.com/list-voices', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
            },
        });

        if (!retellResponse.ok) {
            const errorText = await retellResponse.text();
            console.error('Retell voices API error:', retellResponse.status, errorText);
            return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 });
        }

        const voices = await retellResponse.json();

        // Format voices for UI
        const formattedVoices = voices.map((voice: {
            voice_id: string;
            voice_name: string;
            provider: string;
            gender?: string;
            accent?: string;
            age?: string;
            preview_audio_url?: string;
        }) => ({
            id: voice.voice_id,
            name: voice.voice_name,
            provider: voice.provider,
            gender: voice.gender,
            accent: voice.accent,
            age: voice.age,
            preview_url: voice.preview_audio_url,
        }));

        return NextResponse.json({ data: formattedVoices });
    } catch (error) {
        console.error('Error fetching voices:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
