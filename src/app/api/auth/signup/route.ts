import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { sendEmail } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';
import { safeParseJson } from '@/lib/validation';
import { BETA_PRICE_ID } from '@/lib/billing/tiers';

// Use admin client to bypass RLS for signup
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const { email, password, fullName, agencyName, promoCode } = bodyOrError;

        if (!email || !password || !fullName || !agencyName) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validate email format
        if (typeof email !== 'string' || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate input lengths
        if (typeof fullName !== 'string' || fullName.length > 200) {
            return NextResponse.json({ error: 'Name is too long' }, { status: 400 });
        }
        if (typeof agencyName !== 'string' || agencyName.length > 200) {
            return NextResponse.json({ error: 'Agency name is too long' }, { status: 400 });
        }

        // Sanitize names: strip HTML-sensitive chars and control characters
        const sanitizedName = fullName.replace(/[<>&]/g, '').replace(/[\x00-\x1f]/g, '').trim();
        const sanitizedAgencyName = agencyName.replace(/[<>&]/g, '').replace(/[\x00-\x1f]/g, '').trim();

        if (!sanitizedName || !sanitizedAgencyName) {
            return NextResponse.json(
                { error: 'Name contains invalid characters' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }
        if (password.length > 128) {
            return NextResponse.json(
                { error: 'Password must be less than 128 characters' },
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
                full_name: sanitizedName,
                agency_name: sanitizedAgencyName,
                role: 'agency_admin',
            },
        });

        if (authError) {
            console.error('Signup auth error:', authError.status);
            // Surface duplicate email errors clearly
            if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
            }
            return NextResponse.json({ error: 'Failed to create account' }, { status: 400 });
        }

        if (!authData.user) {
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        // Determine if this is a beta signup via promo code
        const betaPromoCode = process.env.BETA_PROMO_CODE;
        const betaEndDateStr = process.env.BETA_TRIAL_END_DATE; // e.g. "2026-04-30"
        const isBeta = !!(
            promoCode &&
            typeof promoCode === 'string' &&
            betaPromoCode &&
            promoCode.trim().toLowerCase() === betaPromoCode.trim().toLowerCase()
        );

        if (promoCode && !isBeta) {
            // Cleanup: delete the auth user since signup won't complete
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
        }

        // Create agency with free trial (7 days standard, or beta end date for beta users)
        const baseSlug = sanitizedAgencyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
        const trialDays = parseInt(process.env.TRIAL_DAYS || '7', 10);

        let trialEnd: Date;
        if (isBeta && betaEndDateStr) {
            trialEnd = new Date(betaEndDateStr + 'T23:59:59.999Z');
        } else {
            trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + trialDays);
        }

        const agencyInsert: Record<string, unknown> = {
            name: sanitizedAgencyName,
            slug,
            branding: {
                primary_color: '#0f172a',
                secondary_color: '#1e293b',
                accent_color: '#3b82f6',
                company_name: sanitizedAgencyName,
            },
            subscription_status: 'trialing',
            subscription_current_period_end: trialEnd.toISOString(),
        };

        if (isBeta) {
            agencyInsert.is_beta = true;
            agencyInsert.beta_ends_at = trialEnd.toISOString();
            agencyInsert.subscription_price_id = BETA_PRICE_ID;
        }

        const { data: agency, error: agencyError } = await supabaseAdmin
            .from('agencies')
            .insert(agencyInsert)
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
            full_name: sanitizedName,
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

        // Send welcome email (background — guaranteed to complete via waitUntil)
        waitUntil(
            sendEmail({
                to: email,
                ...welcomeEmail({
                    userName: sanitizedName,
                    agencyName: sanitizedAgencyName,
                    trialDays: isBeta ? undefined : trialDays,
                    isBeta,
                    betaEndDate: isBeta ? trialEnd : undefined,
                }),
            }).catch(() => { /* logged inside sendEmail */ })
        );

        return NextResponse.json({
            success: true,
            message: skipVerification
                ? 'Account created successfully'
                : 'Please check your email to verify your account',
            skipVerification,
        });
    } catch (error) {
        console.error('Signup error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
