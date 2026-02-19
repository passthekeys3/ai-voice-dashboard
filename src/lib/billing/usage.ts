/**
 * Usage accumulation for per-minute client billing
 *
 * After each completed call, this function atomically increments
 * the usage counters for the current billing period (calendar month).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface AccumulateUsageParams {
    clientId: string;
    durationSeconds: number;
    costCents: number; // Agency-billed cost (at their per-minute rate), NOT provider cost
}

/**
 * Get the first and last day of the current month as DATE strings (YYYY-MM-DD)
 */
function getCurrentPeriod(): { periodStart: string; periodEnd: string } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    const periodStart = new Date(Date.UTC(year, month, 1));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0)); // Last day of current month

    return {
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
    };
}

/**
 * Atomically increment usage for a client's current billing period.
 * Uses a PostgreSQL function with ON CONFLICT for safe concurrent access.
 */
export async function accumulateUsage(
    supabase: SupabaseClient,
    params: AccumulateUsageParams
): Promise<void> {
    const { clientId, durationSeconds, costCents } = params;
    const { periodStart, periodEnd } = getCurrentPeriod();
    const minutes = Math.round((durationSeconds / 60) * 100) / 100; // 2 decimal places

    const { error } = await supabase.rpc('increment_usage', {
        p_client_id: clientId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_calls: 1,
        p_minutes: minutes,
        p_cost_cents: costCents,
    });

    if (error) {
        console.error('Failed to accumulate usage:', error);
        throw new Error(`Usage accumulation failed: ${error.message}`);
    }
}

interface UsageData {
    total_calls: number;
    total_minutes: number;
    total_cost_cents: number;
}

interface UsageResult {
    data: UsageData;
    error: null;
}

interface UsageError {
    data: null;
    error: string;
}

/**
 * Get a client's usage for the current billing period.
 * Returns `{ data, error }` so callers can distinguish "no usage yet" from "query failed".
 */
export async function getCurrentUsage(
    supabase: SupabaseClient,
    clientId: string
): Promise<UsageResult | UsageError> {
    const { periodStart, periodEnd } = getCurrentPeriod();

    const { data, error } = await supabase
        .from('usage')
        .select('total_calls, total_minutes, total_cost_cents')
        .eq('client_id', clientId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Failed to get current usage:', error);
        return { data: null, error: error.message };
    }

    return {
        data: data || { total_calls: 0, total_minutes: 0, total_cost_cents: 0 },
        error: null,
    };
}
