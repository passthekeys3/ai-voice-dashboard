/**
 * Application configuration constants
 */

import type { BillingType } from '@/types';

/** Valid billing types for clients */
export const VALID_BILLING_TYPES: BillingType[] = ['subscription', 'per_minute', 'one_time'];
