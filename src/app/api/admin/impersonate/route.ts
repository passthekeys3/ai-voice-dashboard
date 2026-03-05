import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/admin';

const IMPERSONATE_COOKIE = 'admin_impersonate';
const MAX_AGE_SECONDS = 4 * 60 * 60; // 4 hours

/**
 * POST — Start impersonation.
 * Sets an httpOnly cookie with the target agency_id.
 *
 * Security:
 * - Verifies the caller is a platform admin via email allowlist.
 * - Validates the target agency exists.
 * - Cookie is httpOnly (no client JS access), secure in prod, 4h max lifetime.
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate the caller using the real auth client
        const authSupabase = await createAuthClient();
        const { data: { user } } = await authSupabase.auth.getUser();

        if (!user?.email || !isPlatformAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const agencyId = body.agency_id;

        if (!agencyId || typeof agencyId !== 'string') {
            return NextResponse.json({ error: 'agency_id is required' }, { status: 400 });
        }

        // Validate target agency exists
        const serviceSupabase = createServiceClient();
        const { data: agency, error } = await serviceSupabase
            .from('agencies')
            .select('id, name')
            .eq('id', agencyId)
            .single();

        if (error || !agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // Set impersonation cookie
        const cookieStore = await cookies();
        cookieStore.set(IMPERSONATE_COOKIE, agencyId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: MAX_AGE_SECONDS,
            path: '/',
        });

        return NextResponse.json({
            message: `Now impersonating "${agency.name}"`,
            agency_id: agency.id,
            agency_name: agency.name,
        });
    } catch (err) {
        console.error('[IMPERSONATE] POST error:', err instanceof Error ? err.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE — Stop impersonation.
 * Removes the httpOnly cookie.
 */
export async function DELETE() {
    try {
        // Verify caller is still an admin (defense-in-depth)
        const authSupabase = await createAuthClient();
        const { data: { user } } = await authSupabase.auth.getUser();

        if (!user?.email || !isPlatformAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const cookieStore = await cookies();
        cookieStore.set(IMPERSONATE_COOKIE, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0, // Immediately expire
            path: '/',
        });

        return NextResponse.json({ message: 'Impersonation ended' });
    } catch (err) {
        console.error('[IMPERSONATE] DELETE error:', err instanceof Error ? err.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
