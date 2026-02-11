import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * One-time admin route to backfill user_metadata.role for existing users.
 * This ensures the middleware can read the role from the JWT without a DB query.
 *
 * Usage: POST /api/admin/backfill-roles
 * Headers: x-admin-secret: <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Delete this route after running it once in production.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    // Require service role key as auth
    const secret = request.headers.get('x-admin-secret');
    if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // Fetch all profiles
        const { data: profiles, error } = await supabaseAdmin
            .from('profiles')
            .select('id, role');

        if (error || !profiles) {
            return NextResponse.json({ error: 'Failed to fetch profiles', details: error?.message }, { status: 500 });
        }

        let updated = 0;
        let skipped = 0;
        let failed = 0;

        for (const profile of profiles) {
            try {
                // Get existing user metadata
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
                if (!authUser?.user) {
                    skipped++;
                    continue;
                }

                // Skip if role already set
                if (authUser.user.user_metadata?.role) {
                    skipped++;
                    continue;
                }

                // Update user_metadata with role
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    profile.id,
                    {
                        user_metadata: {
                            ...authUser.user.user_metadata,
                            role: profile.role,
                        },
                    }
                );

                if (updateError) {
                    console.error(`Failed to update user ${profile.id}:`, updateError);
                    failed++;
                } else {
                    updated++;
                }
            } catch (err) {
                console.error(`Error processing user ${profile.id}:`, err);
                failed++;
            }
        }

        return NextResponse.json({
            success: true,
            total: profiles.length,
            updated,
            skipped,
            failed,
        });
    } catch (error) {
        console.error('Backfill error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
