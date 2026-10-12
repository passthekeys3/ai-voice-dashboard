import { describe, it, expect } from 'vitest';
import {
    DEFAULT_MODELS,
    RETELL_LLM_MODELS,
    RETELL_VOICE_MODELS,
    VAPI_LLM_MODELS,
    ELEVENLABS_LLM_MODELS,
    ELEVENLABS_VOICE_MODELS,
    PLATFORM_COST_PER_MIN,
    TELEPHONY_COST_PER_MIN,
    defaultModelsFor,
    estimateCostPerMin,
    formatCostPerMin,
    isRetellS2SModel,
    vapiModelProvider,
} from './config';
import { retellModelFields, retellLLMModel } from '@/lib/providers/retell';
import { withVapiSystemPrompt } from '@/lib/providers/vapi';

describe('model lists', () => {
    it('include every provider default, so new agents never start on an unlisted model', () => {
        const has = (list: readonly { value: string }[], v: string) => list.some(m => m.value === v);
        expect(has(RETELL_LLM_MODELS, DEFAULT_MODELS.retell.llm)).toBe(true);
        expect(has(RETELL_VOICE_MODELS, DEFAULT_MODELS.retell.voice)).toBe(true);
        expect(has(VAPI_LLM_MODELS, DEFAULT_MODELS.vapi.llm)).toBe(true);
        expect(has(ELEVENLABS_LLM_MODELS, DEFAULT_MODELS.elevenlabs.llm)).toBe(true);
        expect(has(ELEVENLABS_VOICE_MODELS, DEFAULT_MODELS.elevenlabs.voice)).toBe(true);
    });

    it('have no duplicate IDs', () => {
        for (const list of [RETELL_LLM_MODELS, RETELL_VOICE_MODELS, VAPI_LLM_MODELS, ELEVENLABS_LLM_MODELS, ELEVENLABS_VOICE_MODELS]) {
            const ids = list.map(m => m.value);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    it('defaultModelsFor gives each provider a voice model that provider accepts', () => {
        // ElevenLabs Agents rejects eleven_v3 (only eleven_v3_conversational), a past builder bug
        expect(ELEVENLABS_VOICE_MODELS.some(m => m.value === defaultModelsFor('elevenlabs').voiceModel)).toBe(true);
        expect(defaultModelsFor('vapi').voiceModel).toBe('');
        expect(defaultModelsFor('bland')).toEqual({ llmModel: '', voiceModel: '' });
    });
});

describe('Retell speech-to-speech routing', () => {
    it('sends realtime models as s2s_model and clears model', () => {
        expect(isRetellS2SModel('gpt-realtime-2.1')).toBe(true);
        expect(retellModelFields('gpt-realtime-2.1')).toEqual({ model: null, s2s_model: 'gpt-realtime-2.1' });
    });

    it('sends text LLMs as model and clears s2s_model', () => {
        expect(isRetellS2SModel('gpt-4.1')).toBe(false);
        expect(retellModelFields('gpt-4.1')).toEqual({ model: 'gpt-4.1', s2s_model: null });
    });

    it('reads back whichever field an LLM uses', () => {
        expect(retellLLMModel({ model: null, s2s_model: 'gpt-realtime' })).toBe('gpt-realtime');
        expect(retellLLMModel({ model: 'gpt-4.1', s2s_model: null })).toBe('gpt-4.1');
        expect(retellLLMModel({})).toBe('');
    });
});

describe('vapiModelProvider', () => {
    it('maps listed models to their provider', () => {
        expect(vapiModelProvider('claude-sonnet-5')).toBe('anthropic');
        expect(vapiModelProvider('gemini-3.8-flash')).toBe('google');
        expect(vapiModelProvider('gpt-5.4')).toBe('openai');
    });

    it('falls back to the ID prefix for models not in our list', () => {
        expect(vapiModelProvider('claude-opus-4-6')).toBe('anthropic');
        expect(vapiModelProvider('gemini-2.0-flash')).toBe('google');
        expect(vapiModelProvider('o4-mini')).toBe('openai');
    });
});

describe('withVapiSystemPrompt', () => {
    it('replaces the existing system message and keeps the rest in order', () => {
        const result = withVapiSystemPrompt(
            [{ role: 'system', content: 'old' }, { role: 'assistant', content: 'hi' }],
            'new',
        );
        expect(result).toEqual([{ role: 'system', content: 'new' }, { role: 'assistant', content: 'hi' }]);
    });

    it('adds a system message for assistants that had none (legacy systemPrompt format)', () => {
        expect(withVapiSystemPrompt(undefined, 'prompt')).toEqual([{ role: 'system', content: 'prompt' }]);
    });
});

describe('estimateCostPerMin', () => {
    it('adds Retell platform fee, voice, LLM, and telephony', () => {
        const cost = estimateCostPerMin('retell', 'eleven_flash_v2', 'gpt-4.1')!;
        expect(cost.platform).toBe(PLATFORM_COST_PER_MIN.retell);
        expect(cost.voice).toBe(0.04);
        expect(cost.llm).toBe(0.045);
        expect(cost.total).toBeCloseTo(0.055 + 0.04 + 0.045 + TELEPHONY_COST_PER_MIN, 6);
    });

    it('leaves out the voice charge for speech-to-speech models', () => {
        const cost = estimateCostPerMin('retell', 'eleven_v4', 'gpt-realtime-mini')!;
        expect(cost.voice).toBeNull();
        expect(cost.total).toBeCloseTo(0.055 + 0.07 + TELEPHONY_COST_PER_MIN, 6);
    });

    it('marks an unlisted (retired) LLM as unknown instead of guessing', () => {
        const cost = estimateCostPerMin('retell', 'eleven_v3', 'gemini-2.5-flash')!;
        expect(cost.llm).toBeNull();
        expect(cost.total).toBeCloseTo(0.055 + 0.10 + TELEPHONY_COST_PER_MIN, 6);
    });

    it('charges ElevenLabs a flat platform fee with voice included', () => {
        const cost = estimateCostPerMin('elevenlabs', 'eleven_v4', 'gemini-2.5-flash')!;
        expect(cost.platform).toBe(PLATFORM_COST_PER_MIN.elevenlabs);
        expect(cost.voice).toBe(0);
    });

    it('returns null for providers without an estimate', () => {
        expect(estimateCostPerMin('vapi', '', 'gpt-4o')).toBeNull();
        expect(estimateCostPerMin('bland', '', '')).toBeNull();
    });
});

describe('formatCostPerMin', () => {
    it('formats prices for dropdowns', () => {
        expect(formatCostPerMin(0)).toBe('Included');
        expect(formatCostPerMin(0.045)).toBe('$0.045/min');
        expect(formatCostPerMin(0.0032)).toBe('$0.0032/min');
    });
});
