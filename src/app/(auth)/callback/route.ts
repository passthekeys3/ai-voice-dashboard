import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // Prevent open redirect: only allow relative paths starting with /
    // Block protocol-relative URLs (//evil.com), absolute URLs, and data: URIs
    const rawNext = searchParams.get('next') ?? '/';
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

    if (code) {
        const supabase = await createAuthClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Check if user has a profile (Google OAuth users won't on first sign-in)
                const serviceSupabase = createServiceClient();
                const { data: profile } = await serviceSupabase
                    .from('profiles')
                    .select('id')
                    .eq('id', user.id)
                    .single();

                if (!profile) {
                    // New OAuth user — redirect to complete signup (agency name etc.)
                    return NextResponse.redirect(`${origin}/complete-signup`);
                }
            }

            // If this was an email verification (no explicit next destination),
            // redirect to login with a success message
            if (next === '/' && user?.email_confirmed_at) {
                const confirmedAt = new Date(user.email_confirmed_at);
                const now = new Date();
                // If confirmed within the last 30 seconds, this is a fresh verification
                if (now.getTime() - confirmedAt.getTime() < 30000) {
                    return NextResponse.redirect(
                        `${origin}/login?message=email_verified`
                    );
                }
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // Return the user to login with error
    return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}
