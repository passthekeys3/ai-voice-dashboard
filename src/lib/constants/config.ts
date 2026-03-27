/**
 * Application configuration constants
 *
 * Shared values used across multiple files. Only add values here
 * if they are duplicated in 2+ files with the same meaning.
 * File-local constants (used in one place) should stay local.
 */

import type { BillingType } from '@/types';

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

/** ElevenLabs voice model versions available on Retell */
export const RETELL_VOICE_MODELS = [
    { value: 'eleven_v3', label: 'ElevenLabs v3', description: 'Latest, highest quality', costPerMin: 0.08 },
    { value: 'eleven_turbo_v2', label: 'Turbo v2', description: 'High quality, English', costPerMin: 0.07 },
    { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5', description: 'High quality, multilingual', costPerMin: 0.07 },
    { value: 'eleven_flash_v2', label: 'Flash v2', description: 'Fast, English only', costPerMin: 0.045 },
    { value: 'eleven_flash_v2_5', label: 'Flash v2.5', description: 'Fast, multilingual', costPerMin: 0.045 },
    { value: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'Standard multilingual', costPerMin: 0.07 },
] as const;

/** LLM models available on Retell */
export const RETELL_LLM_MODELS = [
    { value: 'gpt-4.1', label: 'GPT-4.1', description: 'Default, balanced', costPerMin: 0.01 },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Faster, cheaper', costPerMin: 0.006 },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', description: 'Fastest, cheapest', costPerMin: 0.003 },
    { value: 'gpt-5', label: 'GPT-5', description: 'Most capable', costPerMin: 0.03 },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini', description: 'Fast and capable', costPerMin: 0.02 },
    { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet', description: 'Strong reasoning', costPerMin: 0.06 },
    { value: 'claude-4.6-sonnet', label: 'Claude 4.6 Sonnet', description: 'Latest Claude', costPerMin: 0.08 },
    { value: 'claude-4.5-haiku', label: 'Claude 4.5 Haiku', description: 'Fast Claude', costPerMin: 0.01 },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast Gemini', costPerMin: 0.008 },
    { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash', description: 'Latest Gemini', costPerMin: 0.01 },
] as const;

/** LLM models available on Vapi (provider + model pairs) */
export const VAPI_LLM_MODELS = [
    { provider: 'openai', value: 'gpt-4o', label: 'GPT-4o', description: 'Default, balanced', costPerMin: 0.01 },
    { provider: 'openai', value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Faster, cheaper', costPerMin: 0.005 },
    { provider: 'anthropic', value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Strong reasoning', costPerMin: 0.04 },
    { provider: 'anthropic', value: 'claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fast Claude', costPerMin: 0.01 },
    { provider: 'google', value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Fast Gemini', costPerMin: 0.005 },
    { provider: 'google', value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Capable Gemini', costPerMin: 0.02 },
] as const;

/** Estimated telephony cost per minute (Retell/Twilio) */
export const TELEPHONY_COST_PER_MIN = 0.015;
