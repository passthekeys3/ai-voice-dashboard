import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use admin client to bypass RLS for signup
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { email, password, fullName, agencyName } = await request.json();

        if (!email || !password || !fullName || !agencyName) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Create user with admin client
        // email_confirm: true = auto-confirmed (no verification email needed)
        // email_confirm: false = unconfirmed (must verify via email before login)
        const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true';
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: skipVerification,
            user_metadata: {
                full_name: fullName,
                agency_name: agencyName,
                role: 'agency_admin',
            },
        });

        if (authError) {
            console.error('Signup auth error:', authError);
            // Surface duplicate email errors clearly
            if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
            }
            return NextResponse.json({ error: 'Failed to create account' }, { status: 400 });
        }

        if (!authData.user) {
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        // Create agency
        const baseSlug = agencyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
        const { data: agency, error: agencyError } = await supabaseAdmin
            .from('agencies')
            .insert({
                name: agencyName,
                slug,
                branding: {
                    primary_color: '#0f172a',
                    secondary_color: '#1e293b',
                    accent_color: '#3b82f6',
                    company_name: agencyName,
                },
            })
            .select()
            .single();

        if (agencyError) {
            // Cleanup: delete the user if agency creation fails
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json(
                { error: 'Failed to create agency' },
                { status: 500 }
            );
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            agency_id: agency.id,
            role: 'agency_admin',
        });

        if (profileError) {
            // Cleanup
            await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json(
                { error: 'Failed to create profile' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: skipVerification
                ? 'Account created successfully'
                : 'Please check your email to verify your account',
            skipVerification,
        });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
