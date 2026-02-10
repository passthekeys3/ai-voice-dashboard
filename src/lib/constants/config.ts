/**
 * Application configuration constants
 * Centralized location for hardcoded values
 */

// =====================================================
// ROUTE CONFIGURATION
// =====================================================

/** Routes that don't require authentication */
export const PUBLIC_ROUTES = [
    '/login',
    '/signup',
    '/callback',
    '/forgot-password',
    '/reset-password',
] as const;

/** Routes that should redirect to dashboard if already authenticated */
export const AUTH_ROUTES = ['/login', '/signup'] as const;

// =====================================================
// PAGINATION DEFAULTS
// =====================================================

/** Default number of items per page */
export const DEFAULT_PAGE_LIMIT = 50;

/** Maximum allowed items per page */
export const MAX_PAGE_LIMIT = 100;

/** Default page number */
export const DEFAULT_PAGE = 1;

// =====================================================
// CALL CONFIGURATION
// =====================================================

/** Default sort field for calls table */
export const DEFAULT_CALLS_SORT_FIELD = 'started_at';

/** Default sort direction */
export const DEFAULT_SORT_DIRECTION = 'desc' as const;

/** Maximum call duration in seconds before auto-end (1 hour) */
export const MAX_CALL_DURATION_SECONDS = 3600;

// =====================================================
// RETRY CONFIGURATION
// =====================================================

/** Default max retries for scheduled calls */
export const DEFAULT_MAX_RETRIES = 3;

/** Default retry delay in minutes */
export const DEFAULT_RETRY_DELAY_MINUTES = 5;

// =====================================================
// SYNC CONFIGURATION
// =====================================================

/** How often to sync with providers (in milliseconds) */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum agents to sync in one batch */
export const MAX_SYNC_BATCH_SIZE = 100;

// =====================================================
// UI CONFIGURATION
// =====================================================

/** Debounce delay for search inputs (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Toast notification duration (ms) */
export const TOAST_DURATION_MS = 5000;

/** Animation durations */
export const ANIMATION_DURATION = {
    fast: 150,
    normal: 200,
    slow: 300,
} as const;

// =====================================================
// BILLING CONFIGURATION
// =====================================================

import type { BillingType } from '@/types';

/** Valid billing types for clients */
export const VALID_BILLING_TYPES: BillingType[] = ['subscription', 'per_minute', 'one_time'];

/** Validate if a value is a valid billing type */
export function isValidBillingType(value: unknown): value is BillingType {
    return VALID_BILLING_TYPES.includes(value as BillingType);
}

// =====================================================
// ENVIRONMENT HELPERS
// =====================================================

/** Check if running in development mode with auth bypass */
export function isDevBypassEnabled(): boolean {
    return process.env.DEV_BYPASS_AUTH === 'true';
}

/** Check if running in production */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}
