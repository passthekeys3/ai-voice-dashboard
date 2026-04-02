import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { listBlandVoices } from '@/lib/providers/bland';
import { PROVIDER_KEY_SELECT, type ProviderKeyRow } from '@/lib/constants/config';

const PROVIDER_API_TIMEOUT = 15_000;

/**
 * Curated ElevenLabs voices available on Vapi by default.
 * Vapi doesn't expose a list-voices API — it relies on third-party TTS providers.
 * These are ElevenLabs' most popular pre-made voices that work out of the box.
 * Voice IDs sourced from ElevenLabs' public voice library.
 */
const VAPI_ELEVENLABS_VOICES: Array<{
    id: string;
    name: string;
    provider: string;
    gender?: string;
    accent?: string;
    age?: string;
    preview_url?: string;
}> = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', provider: 'vapi', gender: 'female', accent: 'American', age: 'young' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', provider: 'vapi', gender: 'female', accent: 'American', age: 'young' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', provider: 'vapi', gender: 'female', accent: 'American', age: 'young' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', provider: 'vapi', gender: 'female', accent: 'American', age: 'young' },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', provider: 'vapi', gender: 'female', accent: 'British', age: 'middle-aged' },
    { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', provider: 'vapi', gender: 'female', accent: 'British', age: 'middle-aged' },
    { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', provider: 'vapi', gender: 'female', accent: 'British', age: 'middle-aged' },
    { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', provider: 'vapi', gender: 'female', accent: 'American', age: 'young' },
    { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya', provider: 'vapi', gender: 'female', accent: 'American', age: 'young' },
    { id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda', provider: 'vapi', gender: 'female', accent: 'American', age: 'middle-aged' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', provider: 'vapi', gender: 'male', accent: 'American', age: 'young' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', provider: 'vapi', gender: 'male', accent: 'American', age: 'middle-aged' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', provider: 'vapi', gender: 'male', accent: 'American', age: 'middle-aged' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', provider: 'vapi', gender: 'male', accent: 'American', age: 'young' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', provider: 'vapi', gender: 'male', accent: 'American', age: 'young' },
    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', provider: 'vapi', gender: 'male', accent: 'Australian', age: 'middle-aged' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', provider: 'vapi', gender: 'male', accent: 'American', age: 'young' },
    { id: 'ZQe5CZNOzWyzPSCn5a3c', name: 'James', provider: 'vapi', gender: 'male', accent: 'Australian', age: 'mature' },
    { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', provider: 'vapi', gender: 'male', accent: 'American', age: 'young' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', provider: 'vapi', gender: 'male', accent: 'British', age: 'middle-aged' },
    { id: 'N2lVS1w4EoAxEBqZHePr', name: 'Callum', provider: 'vapi', gender: 'male', accent: 'British', age: 'middle-aged' },
    { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', provider: 'vapi', gender: 'male', accent: 'American', age: 'middle-aged' },
];

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
            .select(PROVIDER_KEY_SELECT)
            .eq('id', user.agency.id)
            .single() as { data: ProviderKeyRow | null };

        // Decrypt API keys (stored encrypted in DB)
        const retellKey = agency?.retell_api_key ? decrypt(agency.retell_api_key) : null;
        const vapiKey = agency?.vapi_api_key ? decrypt(agency.vapi_api_key) : null;
        const blandKey = agency?.bland_api_key ? decrypt(agency.bland_api_key) : null;
        const elevenlabsKey = agency?.elevenlabs_api_key ? decrypt(agency.elevenlabs_api_key) : null;

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
        if (retellKey && (!providerParam || providerParam === 'retell')) {
            try {
                const retellResponse = await fetch('https://api.retellai.com/list-voices', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${retellKey}`,
                    },
                    signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
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
                console.error('Error fetching Retell voices:', err instanceof Error ? err.message : 'Unknown error');
            }
        }

        // Fetch Bland voices
        if (blandKey && (!providerParam || providerParam === 'bland')) {
            try {
                const blandVoices = await listBlandVoices(blandKey);
                for (const voice of blandVoices) {
                    allVoices.push({
                        id: voice.voice_id,
                        name: voice.name,
                        provider: 'bland',
                        preview_url: voice.preview_url,
                    });
                }
            } catch (err) {
                console.error('Error fetching Bland voices:', err instanceof Error ? err.message : 'Unknown error');
            }
        }

        // Fetch ElevenLabs voices
        if (elevenlabsKey && (!providerParam || providerParam === 'elevenlabs')) {
            try {
                const elevenlabsResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
                    method: 'GET',
                    headers: {
                        'xi-api-key': elevenlabsKey,
                    },
                    signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                });

                if (elevenlabsResponse.ok) {
                    const data = await elevenlabsResponse.json();
                    const voices = data.voices || [];
                    for (const voice of voices) {
                        allVoices.push({
                            id: voice.voice_id,
                            name: voice.name,
                            provider: 'elevenlabs',
                            gender: voice.labels?.gender,
                            accent: voice.labels?.accent,
                            preview_url: voice.preview_url,
                        });
                    }
                }
            } catch (err) {
                console.error('Error fetching ElevenLabs voices:', err instanceof Error ? err.message : 'Unknown error');
            }
        }

        // Vapi voices: Vapi uses third-party TTS providers (ElevenLabs, PlayHT, etc.)
        // and has no list-voices endpoint. We provide curated ElevenLabs defaults
        // that work out of the box with any Vapi account.
        if (vapiKey && (!providerParam || providerParam === 'vapi')) {
            for (const voice of VAPI_ELEVENLABS_VOICES) {
                allVoices.push(voice);
            }
        }

        if (allVoices.length === 0 && !retellKey && !vapiKey && !blandKey && !elevenlabsKey) {
            return NextResponse.json({ error: 'No voice provider API key configured' }, { status: 400 });
        }

        return NextResponse.json({ data: allVoices });
    } catch (error) {
        console.error('Error fetching voices:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
