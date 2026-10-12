import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sign } from 'retell-sdk';

const upsert = vi.fn(async () => ({ error: null }));
const insertEvent = vi.fn(async () => ({ error: null }));

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
            if (table === 'webhook_events') return { insert: insertEvent };
            return { upsert };
        },
    }),
}));
vi.mock('@/lib/providers/resolve-keys', () => ({
    resolveProviderApiKeys: async () => ({ retell_api_key: 'key_test', source: { retell: 'agency' } }),
    getProviderKey: () => 'key_test',
}));
vi.mock('@/lib/webhooks/post-process', () => ({ runPostProcessingPipeline: vi.fn() }));
vi.mock('@/lib/realtime/broadcast', () => ({ broadcastTranscriptUpdate: vi.fn(async () => {}) }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

const { handleWebhookEvent } = await import('./handler');
const { parseRetellWebhook } = await import('./adapters/retell');

const body = JSON.stringify({
    event: 'call_ended',
    call: {
        call_id: 'call_1',
        agent_id: 'ext_agent_1',
        call_type: 'phone_call',
        call_status: 'ended',
        start_timestamp: 1_700_000_000_000,
        end_timestamp: 1_700_000_060_000,
        direction: 'inbound',
    },
});

function headers(signature?: string) {
    const h = new Headers();
    if (signature) h.set('x-retell-signature', signature);
    return h;
}

describe('Retell webhook signature verification', () => {
    beforeEach(() => {
        upsert.mockClear();
        insertEvent.mockClear();
    });

    it('accepts a payload signed with the agency key', async () => {
        const signature = await sign(body, 'key_test');
        const res = await handleWebhookEvent(parseRetellWebhook(body, headers(signature)));

        expect(res.status).toBe(200);
        expect(upsert).toHaveBeenCalledOnce();
    });

    it('rejects a tampered payload with 401 and writes nothing', async () => {
        const signature = await sign(body, 'key_test');
        const tampered = body.replace('"ended"', '"error"');
        const res = await handleWebhookEvent(parseRetellWebhook(tampered, headers(signature)));

        expect(res.status).toBe(401);
        expect(insertEvent).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('rejects a payload signed with a different key', async () => {
        const signature = await sign(body, 'someone_elses_key');
        const res = await handleWebhookEvent(parseRetellWebhook(body, headers(signature)));

        expect(res.status).toBe(401);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('rejects a request with no signature header', async () => {
        const res = await handleWebhookEvent(parseRetellWebhook(body, headers()));

        expect(res.status).toBe(401);
        expect(upsert).not.toHaveBeenCalled();
    });
});
