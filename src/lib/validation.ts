/**
 * Shared validation utilities
 */

import { NextResponse } from 'next/server';

/** Strict UUID v4 regex (case-insensitive) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches a 6-digit hex color string like #0f172a */
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * Validate that a string is a well-formed UUID.
 * Use this to fail-fast before hitting the database with user-supplied IDs.
 */
export function isValidUuid(value: string): boolean {
    return UUID_RE.test(value);
}

/**
 * Safely parse JSON from a request body.
 * Returns the parsed object on success, or a 400 NextResponse on malformed JSON.
 *
 * The generic type parameter allows call sites to specify an expected body shape
 * (e.g., `safeParseJson<{ name: string }>(request)`). When omitted, the default
 * `Record<string, unknown>` is used — callers must then narrow or assert field
 * types after runtime validation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeParseJson<T = Record<string, any>>(
    request: Request,
): Promise<T | NextResponse> {
    try {
        return await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 },
        );
    }
}
