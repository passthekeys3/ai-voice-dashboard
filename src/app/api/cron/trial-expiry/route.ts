import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { trialEndingEmail } from '@/lib/email/templates';

/**
 * Cron endpoint to send trial-ending reminder emails.
 *
 * Finds agencies whose trial ends within the next 3 days and emails
 * each agency admin. Runs daily — admins receive reminders on day 3,
 * day 2, and day 1 (progressive urgency).
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
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

        // Find agencies whose trial ends within the next 3 days
        const { data: trialingAgencies, error: agenciesError } = await supabase
            .from('agencies')
            .select('id, name, subscription_current_period_end')
            .eq('subscription_status', 'trialing')
            .gt('subscription_current_period_end', now.toISOString())
            .lte('subscription_current_period_end', threeDaysFromNow.toISOString());

        if (agenciesError) {
            console.error('[TRIAL EXPIRY] Error fetching agencies:', agenciesError.code);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!trialingAgencies || trialingAgencies.length === 0) {
            return NextResponse.json({
                message: 'No expiring trials found',
                agencies_notified: 0,
                emails_sent: 0,
            });
        }

        console.log(`[TRIAL EXPIRY] Found ${trialingAgencies.length} agencies with trials ending within 3 days`);

        const results = {
            agencies_notified: 0,
            emails_sent: 0,
            errors: [] as string[],
        };

        for (const agency of trialingAgencies) {
            try {
                const periodEnd = new Date(agency.subscription_current_period_end);
                const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

                // Fetch agency admins
                const { data: admins, error: adminsError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .eq('agency_id', agency.id)
                    .eq('role', 'agency_admin');

                if (adminsError || !admins || admins.length === 0) {
                    console.warn(`[TRIAL EXPIRY] No admins found for agency ${agency.id}`);
                    continue;
                }

                let agencyEmailsSent = 0;

                for (const admin of admins) {
                    if (!admin.email) continue;

                    const email = trialEndingEmail({
                        userName: admin.full_name || 'there',
                        daysRemaining,
                    });

                    const sent = await sendEmail({
                        to: admin.email,
                        subject: email.subject,
                        html: email.html,
                        text: email.text,
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
                    console.log(`[TRIAL EXPIRY] Agency "${agency.name}" (${agency.id}): sent ${agencyEmailsSent} email(s), ${daysRemaining} day(s) remaining`);
                }
            } catch (agencyErr) {
                console.error(`[TRIAL EXPIRY] Error processing agency ${agency.id}:`, agencyErr instanceof Error ? agencyErr.message : 'Unknown error');
                results.errors.push(`Agency ${agency.id} failed`);
            }
        }

        console.log('[TRIAL EXPIRY] Complete:', results);

        return NextResponse.json({
            message: 'Trial expiry check completed',
            ...results,
        });
    } catch (error) {
        console.error('[TRIAL EXPIRY] Fatal error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
