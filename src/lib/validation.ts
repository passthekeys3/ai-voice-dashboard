/**
 * Shared validation utilities
 */

import { NextResponse } from 'next/server';

/** Strict UUID v4 regex (case-insensitive) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 */
export async function safeParseJson(
    request: Request,
): Promise<Record<string, unknown> | NextResponse> {
    try {
        return await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 },
        );
    }
}
