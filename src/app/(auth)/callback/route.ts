import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // If this was an email verification (no explicit next destination),
            // redirect to login with a success message
            if (next === '/') {
                const { data: { user } } = await supabase.auth.getUser();
                // Check if user just confirmed their email (new signup)
                if (user?.email_confirmed_at) {
                    const confirmedAt = new Date(user.email_confirmed_at);
                    const now = new Date();
                    // If confirmed within the last 30 seconds, this is a fresh verification
                    if (now.getTime() - confirmedAt.getTime() < 30000) {
                        return NextResponse.redirect(
                            `${origin}/login?message=${encodeURIComponent('Email verified. Please sign in.')}`
                        );
                    }
                }
            }
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // Return the user to login with error
    return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}
