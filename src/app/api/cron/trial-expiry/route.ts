import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { trialEndingEmail, betaEndingEmail } from '@/lib/email/templates';

/**
 * Cron endpoint to manage trial and beta expiry.
 *
 * Phase 1: Expire past-due trials — flip status from 'trialing' → 'expired'
 *          for agencies whose subscription_current_period_end has passed.
 * Phase 2: Send reminder emails for normal trials ending within 3 days.
 * Phase 3: Send reminder emails for beta access ending within 3 days.
 *
 * Runs daily. Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET not configured - rejecting cron request for security');
            return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
        }

        const expected = `Bearer ${cronSecret}`;
        if (
            !authHeader ||
            authHeader.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
        ) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();
        const now = new Date();
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const results = {
            trials_expired: 0,
            betas_expired: 0,
            agencies_notified: 0,
            emails_sent: 0,
            errors: [] as string[],
        };

        // ── Phase 1: Expire past-due trials ──────────────────────────
        // Flip status from 'trialing' → 'expired' for agencies whose period has passed.
        // This covers both normal trials and beta trials (beta_ends_at == subscription_current_period_end).
        const { data: expiredAgencies, error: expireError } = await supabase
            .from('agencies')
            .update({ subscription_status: 'expired' })
            .eq('subscription_status', 'trialing')
            .lt('subscription_current_period_end', now.toISOString())
            .select('id, name, is_beta');

        if (expireError) {
            console.error('[TRIAL EXPIRY] Error expiring past-due trials:', expireError.code);
            results.errors.push('Failed to expire past-due trials');
        } else if (expiredAgencies && expiredAgencies.length > 0) {
            const normalCount = expiredAgencies.filter(a => !a.is_beta).length;
            const betaCount = expiredAgencies.filter(a => a.is_beta).length;
            results.trials_expired = normalCount;
            results.betas_expired = betaCount;
            console.info(`[TRIAL EXPIRY] Expired ${normalCount} trial(s) and ${betaCount} beta(s)`);
        }

        // ── Phase 2: Remind normal trials ending within 3 days ───────
        const { data: soonExpiringTrials, error: trialsError } = await supabase
            .from('agencies')
            .select('id, name, subscription_current_period_end')
            .eq('subscription_status', 'trialing')
            .gt('subscription_current_period_end', now.toISOString())
            .lte('subscription_current_period_end', threeDaysFromNow.toISOString())
            .or('is_beta.is.null,is_beta.eq.false');

        if (trialsError) {
            console.error('[TRIAL EXPIRY] Error fetching soon-expiring trials:', trialsError.code);
            results.errors.push('Failed to fetch soon-expiring trials');
        } else if (soonExpiringTrials && soonExpiringTrials.length > 0) {
            console.info(`[TRIAL EXPIRY] Found ${soonExpiringTrials.length} trial(s) ending within 3 days`);
            for (const agency of soonExpiringTrials) {
                // Only send on specific days (3 days, 1 day) to avoid daily duplicates
                const daysLeft = Math.ceil(
                    (new Date(agency.subscription_current_period_end).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
                );
                if (daysLeft === 3 || daysLeft === 1) {
                    await sendReminders(supabase, agency, agency.subscription_current_period_end, now, results, false);
                }
            }
        }

        // ── Phase 3: Remind betas ending within 3 days ──────────────
        const { data: soonExpiringBetas, error: betasError } = await supabase
            .from('agencies')
            .select('id, name, beta_ends_at')
            .eq('subscription_status', 'trialing')
            .eq('is_beta', true)
            .gt('beta_ends_at', now.toISOString())
            .lte('beta_ends_at', threeDaysFromNow.toISOString());

        if (betasError) {
            console.error('[TRIAL EXPIRY] Error fetching soon-expiring betas:', betasError.code);
            results.errors.push('Failed to fetch soon-expiring betas');
        } else if (soonExpiringBetas && soonExpiringBetas.length > 0) {
            console.info(`[TRIAL EXPIRY] Found ${soonExpiringBetas.length} beta(s) ending within 3 days`);
            for (const agency of soonExpiringBetas) {
                const daysLeft = Math.ceil(
                    (new Date(agency.beta_ends_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
                );
                if (daysLeft === 3 || daysLeft === 1) {
                    await sendReminders(supabase, agency, agency.beta_ends_at, now, results, true);
                }
            }
        }

        console.info('[TRIAL EXPIRY] Complete:', results);

        return NextResponse.json({
            message: 'Trial expiry check completed',
            ...results,
        });
    } catch (error) {
        console.error('[TRIAL EXPIRY] Fatal error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** Send reminder emails to all agency_admin profiles for a given agency. */
async function sendReminders(
    supabase: ReturnType<typeof createServiceClient>,
    agency: { id: string; name: string },
    endDateStr: string,
    now: Date,
    results: { agencies_notified: number; emails_sent: number; errors: string[] },
    isBeta: boolean,
) {
    try {
        const periodEnd = new Date(endDateStr);
        const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        // Fetch agency admins
        const { data: admins, error: adminsError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('agency_id', agency.id)
            .eq('role', 'agency_admin');

        if (adminsError || !admins || admins.length === 0) {
            console.warn(`[TRIAL EXPIRY] No admins found for agency ${agency.id}`);
            return;
        }

        let agencyEmailsSent = 0;

        for (const admin of admins) {
            if (!admin.email) continue;

            const emailContent = isBeta
                ? betaEndingEmail({ userName: admin.full_name || 'there', daysRemaining })
                : trialEndingEmail({ userName: admin.full_name || 'there', daysRemaining });

            const sent = await sendEmail({
                to: admin.email,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
            });

            if (sent) {
                agencyEmailsSent++;
                results.emails_sent++;
            } else {
                results.errors.push(`Failed to send to ${admin.email} (agency ${agency.id})`);
            }
        }

        if (agencyEmailsSent > 0) {
            results.agencies_notified++;
            const label = isBeta ? 'beta' : 'trial';
            console.info(`[TRIAL EXPIRY] Agency "${agency.name}" (${agency.id}): sent ${agencyEmailsSent} ${label} reminder(s), ${daysRemaining} day(s) remaining`);
        }
    } catch (agencyErr) {
        console.error(`[TRIAL EXPIRY] Error processing agency ${agency.id}:`, agencyErr instanceof Error ? agencyErr.message : 'Unknown error');
        results.errors.push(`Agency ${agency.id} failed`);
    }
}
