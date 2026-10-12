import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestPersona } from '@/types';
import { CLAUDE_FAST_MODEL, CLAUDE_EFFORT } from '@/lib/ai/models';

type Req = { model: string; system: string; output_config?: { effort?: string }; messages: { role: string; content: string }[] };
const requests: Req[] = [];
const replies: string[] = [];

vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        messages = {
            create: async (req: Req) => {
                requests.push(req);
                return {
                    // Newer models can lead with a thinking block; the text must still be found
                    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: replies.shift() ?? '' }],
                    stop_reason: 'end_turn',
                    usage: { input_tokens: 10, output_tokens: 5 },
                };
            },
        };
    },
}));

process.env.ANTHROPIC_API_KEY = 'test';
const { simulateConversation } = await import('./simulator');

const persona = {
    id: 'p1', agency_id: 'a1', name: 'Caller', is_preset: true, created_at: '', updated_at: '',
    traits: { temperament: 'calm', communication_style: 'concise', knowledge_level: 'novice', objection_tendency: 'low' },
} as unknown as TestPersona;

describe('simulateConversation request shape', () => {
    beforeEach(() => {
        requests.length = 0;
        replies.length = 0;
    });

    it('sends every request on the fast model at low effort, starting and ending on a user turn', async () => {
        // opening, caller, agent, caller (ends call)
        replies.push('Hi, thanks for calling Bright Dental.', 'I need a cleaning.', 'Sure, Tuesday at 3?', 'Perfect, thanks. [END_CALL]');

        const result = await simulateConversation({
            agentSystemPrompt: 'You are a dental receptionist.',
            scenario: 'Book a cleaning',
            persona,
            maxTurns: 5,
        });

        expect(result.endReason).toBe('persona_ended');
        expect(result.transcript.map(m => m.role)).toEqual(['agent', 'caller', 'agent', 'caller']);
        expect(requests).toHaveLength(4);
        for (const req of requests) {
            expect(req.model).toBe(CLAUDE_FAST_MODEL);
            expect(req.output_config?.effort).toBe(CLAUDE_EFFORT);
            // Ending on an assistant turn is a prefill, which these models reject with a 400
            expect(req.messages[0].role).toBe('user');
            expect(req.messages.at(-1)!.role).toBe('user');
            for (let i = 1; i < req.messages.length; i++) {
                expect(req.messages[i].role).not.toBe(req.messages[i - 1].role);
            }
        }
    });
});
