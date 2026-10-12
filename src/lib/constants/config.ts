/**
 * Application configuration constants
 *
 * Shared values used across multiple files. Only add values here
 * if they are duplicated in 2+ files with the same meaning.
 * File-local constants (used in one place) should stay local.
 */

import type { BillingType, VoiceProvider, Agency } from '@/types';

// ── Voice Providers ─────────────────────────────────────
// Single source of truth for all provider-related constants.
// Adding a new provider? Update these 4 values and everything flows.

/** All supported voice providers (order = auto-select priority) */
export const VOICE_PROVIDERS: VoiceProvider[] = ['retell', 'vapi', 'bland', 'elevenlabs'];

/** Human-readable provider labels for UI display */
export const PROVIDER_LABELS: Record<string, string> = {
    retell: 'Retell AI',
    vapi: 'Vapi',
    bland: 'Bland.ai',
    elevenlabs: 'ElevenLabs',
};

/** Agency/client DB column names for provider API keys */
export const PROVIDER_KEY_FIELDS = [
    'retell_api_key',
    'vapi_api_key',
    'bland_api_key',
    'elevenlabs_api_key',
] as const;

/** Comma-separated key fields for Supabase .select() queries */
export const PROVIDER_KEY_SELECT = PROVIDER_KEY_FIELDS.join(', ');

/** Type for the result of a Supabase `.select(PROVIDER_KEY_SELECT)` query */
export type ProviderKeyRow = {
    retell_api_key: string | null;
    vapi_api_key: string | null;
    bland_api_key: string | null;
    elevenlabs_api_key: string | null;
};

/** Map provider name → DB column name */
export const PROVIDER_KEY_MAP: Record<VoiceProvider, typeof PROVIDER_KEY_FIELDS[number]> = {
    retell: 'retell_api_key',
    vapi: 'vapi_api_key',
    bland: 'bland_api_key',
    elevenlabs: 'elevenlabs_api_key',
};

/**
 * Determine which voice providers an agency has configured (has API key set).
 * Returns providers in priority order (Retell → Vapi → Bland → ElevenLabs).
 */
export function getAvailableProviders(agency: Pick<Agency, 'retell_api_key' | 'vapi_api_key' | 'bland_api_key' | 'elevenlabs_api_key'>): VoiceProvider[] {
    return VOICE_PROVIDERS.filter(p => !!agency[PROVIDER_KEY_MAP[p]]);
}

// ── Billing ──────────────────────────────────────────────
/** Valid billing types for clients */
export const VALID_BILLING_TYPES: BillingType[] = ['subscription', 'per_minute', 'one_time'];

// ── Content Limits ───────────────────────────────────────
/** Max system prompt / prompt override length (characters) */
export const MAX_PROMPT_LENGTH = 50_000;

/** Max transcript length stored in DB per call (characters) */
export const MAX_TRANSCRIPT_LENGTH = 500_000;

// ── UI Feedback Timers ───────────────────────────────────
/** How long to show "Copied!" feedback before clearing (ms) */
export const COPY_FEEDBACK_TIMEOUT = 2_000;

/** How long to show success/saved notifications before clearing (ms) */
export const SUCCESS_NOTIFICATION_TIMEOUT = 3_000;

// ── OAuth Defaults ───────────────────────────────────────
/** Default token expiry when provider doesn't specify (seconds) — 2 hours */
export const DEFAULT_TOKEN_EXPIRY_SECONDS = 7_200;

// ── Voice & LLM Model Options ───────────────────────────
// Model IDs are checked against each provider's API schema; prices last
// verified 2026-10-12. Providers retire models — re-check these lists
// periodically, since an ID missing from a provider's enum fails agent creation.

/**
 * Model defaults per provider. Existing agents keep whatever they were created
 * with; these only apply to new agents and to missing config values.
 */
export const DEFAULT_MODELS = {
    retell: { llm: 'gpt-4.1', voice: 'eleven_v3' },
    vapi: { llm: 'gpt-4o' },
    elevenlabs: { llm: 'gemini-2.5-flash', voice: 'eleven_flash_v2' },
} as const;

/** Default LLM and voice model for a provider ('' where the provider doesn't take one) */
export function defaultModelsFor(provider: VoiceProvider): { llmModel: string; voiceModel: string } {
    switch (provider) {
        case 'retell': return { llmModel: DEFAULT_MODELS.retell.llm, voiceModel: DEFAULT_MODELS.retell.voice };
        case 'vapi': return { llmModel: DEFAULT_MODELS.vapi.llm, voiceModel: '' };
        case 'elevenlabs': return { llmModel: DEFAULT_MODELS.elevenlabs.llm, voiceModel: DEFAULT_MODELS.elevenlabs.voice };
        case 'bland': return { llmModel: '', voiceModel: '' };
    }
}

/**
 * Flat per-minute platform fee charged on every call, before voice and LLM.
 * Retell: "Retell Voice Infra". ElevenLabs Agents: per-minute call charge
 * (voice model choice doesn't change it).
 */
export const PLATFORM_COST_PER_MIN = {
    retell: 0.055,
    elevenlabs: 0.08,
} as const;

/** ElevenLabs voice models available on Retell; costPerMin is Retell's TTS add-on price */
export const RETELL_VOICE_MODELS = [
    { value: 'eleven_v4_turbo', label: 'ElevenLabs v4 Turbo', description: 'Newest, fast', costPerMin: 0.08 },
    { value: 'eleven_v4', label: 'ElevenLabs v4', description: 'Newest, highest quality', costPerMin: 0.10 },
    { value: 'eleven_v3_conversational', label: 'ElevenLabs v3 Conversational', description: 'Tuned for dialogue', costPerMin: 0.08 },
    { value: 'eleven_v3', label: 'ElevenLabs v3', description: 'Expressive', costPerMin: 0.10 },
    { value: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'Standard multilingual', costPerMin: 0.06 },
    { value: 'eleven_flash_v2_5', label: 'Flash v2.5', description: 'Fast, multilingual', costPerMin: 0.04 },
    { value: 'eleven_flash_v2', label: 'Flash v2', description: 'Fast, English only', costPerMin: 0.04 },
] as const;

/**
 * LLMs available on Retell (https://www.retellai.com/pricing, standard tier).
 * `s2s: true` models are speech-to-speech: Retell takes them in `s2s_model`,
 * not `model`, and they replace the separate voice model.
 */
export const RETELL_LLM_MODELS = [
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Retell recommended', costPerMin: 0.064 },
    { value: 'claude-5-sonnet', label: 'Claude 5 Sonnet', description: 'Retell recommended', costPerMin: 0.064 },
    { value: 'gpt-5.5', label: 'GPT-5.5', description: 'Most capable GPT-5', costPerMin: 0.16 },
    { value: 'gpt-5.4', label: 'GPT-5.4', description: 'Strong, balanced', costPerMin: 0.08 },
    { value: 'gpt-6-astra', label: 'GPT-6 Astra', description: 'Most capable', costPerMin: 0.32 },
    { value: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', description: 'Fast GPT-6', costPerMin: 0.064 },
    { value: 'gpt-6-sol', label: 'GPT-6 Sol', description: 'Fast GPT-6', costPerMin: 0.064 },
    { value: 'gpt-6-luna', label: 'GPT-6 Luna', description: 'Cheapest GPT-6', costPerMin: 0.0032 },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', description: 'Low cost', costPerMin: 0.0064 },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', description: 'Fast GPT-5.4', costPerMin: 0.024 },
    { value: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', description: 'Cheapest GPT-5.4', costPerMin: 0.0064 },
    { value: 'gpt-5.2', label: 'GPT-5.2', description: 'Strong reasoning', costPerMin: 0.056 },
    { value: 'gpt-5.1', label: 'GPT-5.1', description: 'Capable', costPerMin: 0.04 },
    { value: 'gpt-5', label: 'GPT-5', description: 'Capable', costPerMin: 0.04 },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini', description: 'Fast GPT-5', costPerMin: 0.008 },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano', description: 'Cheapest GPT-5', costPerMin: 0.0016 },
    { value: 'gpt-4.1', label: 'GPT-4.1', description: 'Default, balanced', costPerMin: 0.045 },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Faster, cheaper', costPerMin: 0.0128 },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', description: 'Fastest, cheapest', costPerMin: 0.0032 },
    { value: 'claude-5.5-opus', label: 'Claude 5.5 Opus', description: 'Most capable Claude', costPerMin: 0.128 },
    { value: 'claude-5.5-sonnet', label: 'Claude 5.5 Sonnet', description: 'Latest Sonnet', costPerMin: 0.064 },
    { value: 'claude-5.5-haiku', label: 'Claude 5.5 Haiku', description: 'Fast, low cost', costPerMin: 0.0032 },
    { value: 'claude-5-opus', label: 'Claude 5 Opus', description: 'Capable Claude', costPerMin: 0.16 },
    { value: 'claude-4.6-sonnet', label: 'Claude 4.6 Sonnet', description: 'Previous Sonnet', costPerMin: 0.08 },
    { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet', description: 'Previous Sonnet', costPerMin: 0.08 },
    { value: 'claude-4.5-haiku', label: 'Claude 4.5 Haiku', description: 'Previous Haiku', costPerMin: 0.025 },
    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', description: 'Latest Gemini', costPerMin: 0.048 },
    { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', description: 'Fast Gemini', costPerMin: 0.048 },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', description: 'Fast Gemini', costPerMin: 0.024 },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', description: 'Fast Gemini', costPerMin: 0.048 },
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', description: 'Low cost Gemini', costPerMin: 0.0096 },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', description: 'Cheapest Gemini', costPerMin: 0.008 },
    { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash', description: 'Fast Gemini', costPerMin: 0.016 },
    { value: 'gpt-realtime-2.1', label: 'GPT Realtime 2.1', description: 'Speech-to-speech', costPerMin: 0.38, s2s: true },
    { value: 'gpt-realtime-2.1-mini', label: 'GPT Realtime 2.1 Mini', description: 'Fast speech-to-speech', costPerMin: 0.07, s2s: true },
    { value: 'gpt-realtime-2', label: 'GPT Realtime 2', description: 'Speech-to-speech', costPerMin: 0.38, s2s: true },
    { value: 'gpt-realtime-1.5', label: 'GPT Realtime 1.5', description: 'Speech-to-speech', costPerMin: 0.345, s2s: true },
    { value: 'gpt-realtime', label: 'GPT Realtime', description: 'Speech-to-speech', costPerMin: 0.345, s2s: true },
    { value: 'gpt-realtime-mini', label: 'GPT Realtime Mini', description: 'Fast speech-to-speech', costPerMin: 0.07, s2s: true },
] as const;

/** Whether a Retell model ID must be sent as `s2s_model` instead of `model` */
export function isRetellS2SModel(model: string | null | undefined): boolean {
    return !!model && RETELL_LLM_MODELS.some(m => m.value === model && 's2s' in m);
}

// Vapi and ElevenLabs pass LLM usage through at roughly token cost, which works out
// to about 30% of Retell's resale rate for the same model (anchored to ElevenLabs'
// published ~$0.045/min for GPT-5.5 and ~$0.0005/min for GPT-5 Nano). These are
// estimates; the provider bills actual tokens used.

/** LLM models available on Vapi (provider + model pairs) */
export const VAPI_LLM_MODELS = [
    { provider: 'openai', value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced, current', costPerMin: 0.019 },
    { provider: 'openai', value: 'gpt-5.5', label: 'GPT-5.5', description: 'Most capable GPT-5', costPerMin: 0.045 },
    { provider: 'openai', value: 'gpt-5.4', label: 'GPT-5.4', description: 'Strong, balanced', costPerMin: 0.024 },
    { provider: 'openai', value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', description: 'Fast, cheaper', costPerMin: 0.007 },
    { provider: 'openai', value: 'gpt-6-luna', label: 'GPT-6 Luna', description: 'Lowest cost', costPerMin: 0.001 },
    { provider: 'openai', value: 'gpt-4.1', label: 'GPT-4.1', description: 'Balanced', costPerMin: 0.014 },
    { provider: 'openai', value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Faster, cheaper', costPerMin: 0.004 },
    { provider: 'openai', value: 'gpt-4o', label: 'GPT-4o', description: 'Default', costPerMin: 0.015 },
    { provider: 'openai', value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Faster, cheaper', costPerMin: 0.002 },
    { provider: 'anthropic', value: 'claude-sonnet-5', label: 'Claude Sonnet 5', description: 'Strong reasoning', costPerMin: 0.019 },
    { provider: 'anthropic', value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', description: 'Fast, low cost', costPerMin: 0.001 },
    { provider: 'anthropic', value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Previous Sonnet', costPerMin: 0.024 },
    { provider: 'google', value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', description: 'Latest Gemini', costPerMin: 0.014 },
    { provider: 'google', value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', description: 'Fast Gemini', costPerMin: 0.014 },
    { provider: 'google', value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', description: 'Cheapest Gemini', costPerMin: 0.002 },
    { provider: 'google', value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Previous Gemini', costPerMin: 0.01 },
] as const;

/** Vapi's `model.provider` for a model ID (Vapi requires the pair to match) */
export function vapiModelProvider(model: string): 'openai' | 'anthropic' | 'google' {
    const known = VAPI_LLM_MODELS.find(m => m.value === model);
    if (known) return known.provider;
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gemini')) return 'google';
    return 'openai';
}

/** LLM models available on ElevenLabs Agents (billed on top of the platform fee) */
export const ELEVENLABS_LLM_MODELS = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Default, fast', costPerMin: 0.01 },
    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', description: 'Latest Gemini', costPerMin: 0.014 },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', description: 'Cheapest Gemini', costPerMin: 0.002 },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced, current', costPerMin: 0.019 },
    { value: 'gpt-5.5', label: 'GPT-5.5', description: 'Most capable GPT-5', costPerMin: 0.045 },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', description: 'Fast, cheaper', costPerMin: 0.007 },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Previous GPT', costPerMin: 0.015 },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Previous, cheaper', costPerMin: 0.002 },
    { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', description: 'Strong reasoning', costPerMin: 0.019 },
    { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', description: 'Fast, low cost', costPerMin: 0.001 },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', description: 'Previous Sonnet', costPerMin: 0.024 },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Previous Haiku', costPerMin: 0.008 },
] as const;

/**
 * Voice/TTS models available on ElevenLabs Agents. Voice synthesis is included
 * in ElevenLabs' per-minute platform fee, so the model choice adds no cost.
 */
export const ELEVENLABS_VOICE_MODELS = [
    { value: 'eleven_flash_v2', label: 'Flash v2', description: 'Lowest latency, English', costPerMin: 0 },
    { value: 'eleven_flash_v2_5', label: 'Flash v2.5', description: 'Low latency, multilingual', costPerMin: 0 },
    { value: 'eleven_v4_turbo', label: 'v4 Turbo', description: 'Newest, fast', costPerMin: 0 },
    { value: 'eleven_v4', label: 'v4', description: 'Newest, highest quality', costPerMin: 0 },
    { value: 'eleven_v3_conversational', label: 'v3 Conversational', description: 'Tuned for dialogue', costPerMin: 0 },
    { value: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'Standard multilingual', costPerMin: 0 },
] as const;

export interface ModelOption {
    readonly value: string;
    readonly label: string;
    readonly description: string;
    readonly costPerMin: number;
}

/** LLM dropdown options for a provider (empty for providers without model selection) */
export function llmModelsFor(provider: VoiceProvider): readonly ModelOption[] {
    switch (provider) {
        case 'retell': return RETELL_LLM_MODELS;
        case 'vapi': return VAPI_LLM_MODELS;
        case 'elevenlabs': return ELEVENLABS_LLM_MODELS;
        case 'bland': return [];
    }
}

/** Voice model dropdown options for a provider (empty where the voice provider picks it) */
export function voiceModelsFor(provider: VoiceProvider): readonly ModelOption[] {
    switch (provider) {
        case 'retell': return RETELL_VOICE_MODELS;
        case 'elevenlabs': return ELEVENLABS_VOICE_MODELS;
        default: return [];
    }
}

export interface CostBreakdown {
    platform: number;
    /** null when the voice is part of a speech-to-speech model */
    voice: number | null;
    /** null when the model isn't in our price list (e.g. a retired model on an old agent) */
    llm: number | null;
    telephony: number;
    total: number;
}

/**
 * Estimated per-minute cost for a provider + model selection, or null for
 * providers we don't estimate. Unknown parts are left out of the total.
 */
export function estimateCostPerMin(
    provider: VoiceProvider,
    voiceModel: string,
    llmModel: string,
): CostBreakdown | null {
    let platform: number;
    let voice: number | null;
    let llm: number | null;

    if (provider === 'retell') {
        const llmOption = RETELL_LLM_MODELS.find(m => m.value === llmModel);
        platform = PLATFORM_COST_PER_MIN.retell;
        llm = llmOption?.costPerMin ?? null;
        voice = llmOption && 's2s' in llmOption
            ? null
            : RETELL_VOICE_MODELS.find(m => m.value === voiceModel)?.costPerMin ?? null;
    } else if (provider === 'elevenlabs') {
        platform = PLATFORM_COST_PER_MIN.elevenlabs;
        voice = 0;
        llm = ELEVENLABS_LLM_MODELS.find(m => m.value === llmModel)?.costPerMin ?? null;
    } else {
        return null;
    }

    const telephony = TELEPHONY_COST_PER_MIN;
    return { platform, voice, llm, telephony, total: platform + (voice ?? 0) + (llm ?? 0) + telephony };
}

/** Per-minute price for display: "Included" for 0, extra precision for sub-cent prices */
export function formatCostPerMin(cost: number): string {
    if (cost === 0) return 'Included';
    return `$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}/min`;
}

/** Default ElevenLabs voice ID (Rachel — warm, clear) */
export const ELEVENLABS_DEFAULT_VOICE_ID = 'cjVigY5qzO86Huf0OWal';

/** Estimated telephony cost per minute (Retell/Twilio) */
export const TELEPHONY_COST_PER_MIN = 0.015;
