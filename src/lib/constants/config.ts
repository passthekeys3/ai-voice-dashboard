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
