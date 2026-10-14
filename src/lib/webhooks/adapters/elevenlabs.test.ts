import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

const SECRET = 'wsec_test';
const API_KEY = 'el_key_test';

const upsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
const insertEvent = vi.fn(async () => ({ error: null }));
const insertWebhook = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
let storedWebhook: { webhook_id: string; webhook_secret: string } | null;

vi.mock('@/lib/supabase/server', () => ({
    createServiceClient: () => ({
        from: (table: string) => {
            if (table === 'agents') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                single: async () => ({
                                    data: { id: 'agent-1', name: 'Agent', client_id: null, agency_id: 'agency-1', webhook_url: null },
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'elevenlabs_webhooks') {
                return {
                    select: () => ({
                        eq: () => ({ maybeSingle: async () => ({ data: storedWebhook, error: null }) }),
                    }),
                    insert: insertWebhook,
                };
            }
            if (table === 'webhook_events') return { insert: insertEvent };
            return { upsert };
        },
    }),
}));
vi.mock('@/lib/providers/resolve-keys', () => ({
    resolveProviderApiKeys: async () => ({ elevenlabs_api_key: API_KEY, source: { elevenlabs: 'agency' } }),
    getProviderKey: () => API_KEY,
}));
vi.mock('@/lib/webhooks/post-process', () => ({ runPostProcessingPipeline: vi.fn() }));
vi.mock('@/lib/realtime/broadcast', () => ({ broadcastTranscriptUpdate: vi.fn(async () => {}) }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

const { handleWebhookEvent } = await import('../handler');
const { parseElevenLabsWebhook } = await import('./elevenlabs');
const { ensureElevenLabsWebhook, hashApiKey } = await import('@/lib/providers/elevenlabs-webhook');

// Shape from https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
const payload = {
    type: 'post_call_transcription',
    event_timestamp: 1_760_000_000,
    data: {
        agent_id: 'ext_agent_1',
        conversation_id: 'conv_1',
        status: 'done',
        transcript: [
            { role: 'agent', message: 'Hi, this is Ava from Bright Dental.', time_in_call_secs: 0 },
            { role: 'agent', message: null, tool_calls: [{ tool_name: 'book' }], time_in_call_secs: 4 },
            { role: 'user', message: 'I need a cleaning next week.', time_in_call_secs: 5 },
        ],
        metadata: {
            start_time_unix_secs: 1_760_000_000,
            call_duration_secs: 95,
            cost_fiat: 0.1234,
            phone_call: { direction: 'outbound', agent_number: '+14155550100', external_number: '+12125550199', type: 'twilio' },
        },
        analysis: { call_successful: 'success', transcript_summary: 'Booked a cleaning.' },
        conversation_initiation_client_data: {
            dynamic_variables: { contact_name: 'Sam', system__caller_id: '+12125550199' },
        },
    },
};
const body = JSON.stringify(payload);

function sign(payload: string, secret = SECRET, timestampSecs = Math.floor(Date.now() / 1000)) {
    const hmac = crypto.createHmac('sha256', secret).update(`${timestampSecs}.${payload}`).digest('hex');
    return `t=${timestampSecs},v0=${hmac}`;
}

function headers(signature?: string) {
    const h = new Headers();
    if (signature) h.set('elevenlabs-signature', signature);
    return h;
}

describe('ElevenLabs post-call webhook', () => {
    beforeEach(() => {
        upsert.mockClear();
        insertEvent.mockClear();
        storedWebhook = { webhook_id: 'wh_1', webhook_secret: SECRET };
    });

    it('stores a correctly signed post_call_transcription with the right fields', async () => {
        const res = await handleWebhookEvent(parseElevenLabsWebhook(body, headers(sign(body))));

        expect(res.status).toBe(200);
        expect(upsert).toHaveBeenCalledOnce();
        const row = upsert.mock.calls[0][0];
        expect(row).toMatchObject({
            external_id: 'conv_1',
            agent_id: 'agent-1',
            provider: 'elevenlabs',
            status: 'completed',
            direction: 'outbound',
            duration_seconds: 95,
            cost_cents: 12,
            from_number: '+14155550100',
            to_number: '+12125550199',
            started_at: new Date(1_760_000_000_000).toISOString(),
            ended_at: new Date(1_760_000_095_000).toISOString(),
            summary: 'Booked a cleaning.',
            sentiment: 'positive',
            transcript: 'Agent: Hi, this is Ava from Bright Dental.\nUser: I need a cleaning next week.',
        });
        expect(row.metadata).toMatchObject({ contact_name: 'Sam' });
        expect(row.metadata).not.toHaveProperty('system__caller_id');
    });

    it('treats web conversations (no phone_call) as inbound', async () => {
        const { phone_call: _phoneCall, ...metadata } = payload.data.metadata;
        const web = JSON.stringify({ ...payload, data: { ...payload.data, metadata } });
        const res = await handleWebhookEvent(parseElevenLabsWebhook(web, headers(sign(web))));

        expect(res.status).toBe(200);
        expect(upsert.mock.calls[0][0]).toMatchObject({ direction: 'inbound' });
    });

    it('records a failed outbound dial from call_initiation_failure', async () => {
        const failure = JSON.stringify({
            type: 'call_initiation_failure',
            event_timestamp: 1_760_000_000,
            data: { agent_id: 'ext_agent_1', conversation_id: 'conv_2', failure_reason: 'no-answer', metadata: {} },
        });
        const res = await handleWebhookEvent(parseElevenLabsWebhook(failure, headers(sign(failure))));

        expect(res.status).toBe(200);
        expect(upsert.mock.calls[0][0]).toMatchObject({
            external_id: 'conv_2', status: 'failed', duration_seconds: 0, metadata: { failure_reason: 'no-answer' },
        });
    });

    it('rejects a tampered payload with 401 and writes nothing', async () => {
        const tampered = body.replace('"call_duration_secs":95', '"call_duration_secs":9500');
        const res = await handleWebhookEvent(parseElevenLabsWebhook(tampered, headers(sign(body))));

        expect(res.status).toBe(401);
        expect(insertEvent).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('rejects a payload signed with a different secret', async () => {
        const res = await handleWebhookEvent(parseElevenLabsWebhook(body, headers(sign(body, 'someone_elses_secret'))));

        expect(res.status).toBe(401);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('rejects a request with no signature header', async () => {
        const res = await handleWebhookEvent(parseElevenLabsWebhook(body, headers()));

        expect(res.status).toBe(401);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('rejects a replayed request older than 30 minutes', async () => {
        const stale = Math.floor(Date.now() / 1000) - 31 * 60;
        const res = await handleWebhookEvent(parseElevenLabsWebhook(body, headers(sign(body, SECRET, stale))));

        expect(res.status).toBe(401);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('rejects everything when no webhook secret is stored for the key', async () => {
        storedWebhook = null;
        const res = await handleWebhookEvent(parseElevenLabsWebhook(body, headers(sign(body))));

        expect(res.status).toBe(401);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('acknowledges post_call_audio without storing anything', async () => {
        const audio = JSON.stringify({
            type: 'post_call_audio',
            data: { agent_id: 'ext_agent_1', conversation_id: 'conv_1', full_audio: 'AAAA' },
        });
        const res = await handleWebhookEvent(parseElevenLabsWebhook(audio, headers(sign(audio))));

        expect(res.status).toBe(200);
        expect(upsert).not.toHaveBeenCalled();
    });
});

describe('ensureElevenLabsWebhook', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockReset();
        insertWebhook.mockClear();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('reuses the stored webhook for a key', async () => {
        storedWebhook = { webhook_id: 'wh_existing', webhook_secret: SECRET };

        expect(await ensureElevenLabsWebhook(API_KEY)).toBe('wh_existing');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('registers an HMAC webhook and stores its secret on first use', async () => {
        storedWebhook = null;
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ webhook_id: 'wh_new', webhook_secret: 'wsec_new' })));

        expect(await ensureElevenLabsWebhook(API_KEY)).toBe('wh_new');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.elevenlabs.io/v1/workspace/webhooks');
        expect(JSON.parse(init.body)).toEqual({
            settings: { auth_type: 'hmac', name: 'BuildVoiceAI post-call', webhook_url: 'https://app.example.com/api/webhooks/elevenlabs' },
        });
        expect(insertWebhook).toHaveBeenCalledWith(expect.objectContaining({
            api_key_hash: hashApiKey(API_KEY),
            webhook_id: 'wh_new',
        }));
        expect(insertWebhook.mock.calls[0][0]).not.toHaveProperty('api_key');
    });

    it('returns null instead of throwing when ElevenLabs refuses', async () => {
        storedWebhook = null;
        fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 }));

        expect(await ensureElevenLabsWebhook(API_KEY)).toBeNull();
        expect(insertWebhook).not.toHaveBeenCalled();
    });
});
