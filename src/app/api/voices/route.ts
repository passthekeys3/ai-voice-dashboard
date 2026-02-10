import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { listBlandVoices } from '@/lib/providers/bland';

// GET /api/voices - List available voices from configured providers
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // Get API keys for all providers
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        // Check for provider query param to fetch a specific provider's voices
        const providerParam = request.nextUrl.searchParams.get('provider');

        const allVoices: Array<{
            id: string;
            name: string;
            provider: string;
            gender?: string;
            accent?: string;
            age?: string;
            preview_url?: string;
        }> = [];

        // Fetch Retell voices
        if (agency?.retell_api_key && (!providerParam || providerParam === 'retell')) {
            try {
                const retellResponse = await fetch('https://api.retellai.com/list-voices', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${agency.retell_api_key}`,
                    },
                });

                if (retellResponse.ok) {
                    const voices = await retellResponse.json();
                    for (const voice of voices) {
                        allVoices.push({
                            id: voice.voice_id,
                            name: voice.voice_name,
                            provider: voice.provider || 'retell',
                            gender: voice.gender,
                            accent: voice.accent,
                            age: voice.age,
                            preview_url: voice.preview_audio_url,
                        });
                    }
                }
            } catch (err) {
                console.error('Error fetching Retell voices:', err);
            }
        }

        // Fetch Bland voices
        if (agency?.bland_api_key && (!providerParam || providerParam === 'bland')) {
            try {
                const blandVoices = await listBlandVoices(agency.bland_api_key);
                for (const voice of blandVoices) {
                    allVoices.push({
                        id: voice.voice_id,
                        name: voice.name,
                        provider: 'bland',
                        preview_url: voice.preview_url,
                    });
                }
            } catch (err) {
                console.error('Error fetching Bland voices:', err);
            }
        }

        // Note: Vapi voices depend on the TTS provider (ElevenLabs, PlayHT, etc.)
        // They don't have a simple list-voices endpoint

        if (allVoices.length === 0 && !agency?.retell_api_key && !agency?.vapi_api_key && !agency?.bland_api_key) {
            return NextResponse.json({ error: 'No voice provider API key configured' }, { status: 400 });
        }

        return NextResponse.json({ data: allVoices });
    } catch (error) {
        console.error('Error fetching voices:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
