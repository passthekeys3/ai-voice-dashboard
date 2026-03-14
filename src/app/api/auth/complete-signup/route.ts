import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServiceClient } from '@/lib/supabase/server';
import { waitUntil } from '@vercel/functions';
import { sendEmail } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';
import { safeParseJson } from '@/lib/validation';
import { BETA_PRICE_ID } from '@/lib/billing/tiers';

/**
 * POST /api/auth/complete-signup
 *
 * Called after a Google OAuth sign-in when the user has no profile yet.
 * Creates the agency + profile for the already-authenticated user.
 */
export async function POST(request: NextRequest) {
    try {
        // Verify the user is authenticated
        const authSupabase = await createAuthClient();
        const { data: { user } } = await authSupabase.auth.getUser();

        if (!user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = createServiceClient();

        // Prevent double-creation: check if profile already exists
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        if (existingProfile) {
            return NextResponse.json({ error: 'Account already set up' }, { status: 400 });
        }

        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const { agencyName, promoCode } = bodyOrError;

        if (!agencyName) {
            return NextResponse.json({ error: 'Agency name is required' }, { status: 400 });
        }

        if (typeof agencyName !== 'string' || agencyName.length > 200) {
            return NextResponse.json({ error: 'Agency name is too long' }, { status: 400 });
        }

        // Sanitize: strip HTML-sensitive chars and control characters
        const sanitizedAgencyName = agencyName.replace(/[<>&]/g, '').replace(/[\x00-\x1f]/g, '').trim();
        if (!sanitizedAgencyName) {
            return NextResponse.json({ error: 'Agency name contains invalid characters' }, { status: 400 });
        }

        // Get the user's name from their Google profile metadata
        const fullName = user.user_metadata?.full_name
            || user.user_metadata?.name
            || user.email.split('@')[0];
        const sanitizedName = String(fullName).replace(/[<>&]/g, '').replace(/[\x00-\x1f]/g, '').trim() || 'User';

        // Determine if this is a beta signup via promo code
        const betaPromoCode = process.env.BETA_PROMO_CODE;
        const betaEndDateStr = process.env.BETA_TRIAL_END_DATE;
        const isBeta = !!(
            promoCode &&
            typeof promoCode === 'string' &&
            betaPromoCode &&
            promoCode.trim().toLowerCase() === betaPromoCode.trim().toLowerCase()
        );

        if (promoCode && !isBeta) {
            return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
        }

        // Create agency
        const baseSlug = sanitizedAgencyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'agency';
        const generateSlug = () => `${baseSlug}-${Math.random().toString(36).slice(2, 10)}`;
        const slug = generateSlug();
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

        // Retry with new slug on unique constraint violation
        let agency: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) agencyInsert.slug = generateSlug();
            const { data, error: agencyError } = await supabase
                .from('agencies')
                .insert(agencyInsert)
                .select()
                .single();

            if (!agencyError) {
                agency = data;
                break;
            }

            if (agencyError.code === '23505' && attempt < 2) continue;

            console.error('[COMPLETE-SIGNUP] Agency creation failed:', agencyError.code);
            return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 });
        }

        if (!agency) {
            return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 });
        }

        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: sanitizedName,
            agency_id: agency.id,
            role: 'agency_admin',
        });

        if (profileError) {
            // Cleanup: delete the agency
            await supabase.from('agencies').delete().eq('id', agency.id);
            console.error('[COMPLETE-SIGNUP] Profile creation failed:', profileError.code);
            return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
        }

        // Send welcome email (background)
        waitUntil(
            sendEmail({
                to: user.email,
                ...welcomeEmail({
                    userName: sanitizedName,
                    agencyName: sanitizedAgencyName,
                    trialDays: isBeta ? undefined : trialDays,
                    isBeta,
                    betaEndDate: isBeta ? trialEnd : undefined,
                }),
            }).catch(() => { /* logged inside sendEmail */ })
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[COMPLETE-SIGNUP] Error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
