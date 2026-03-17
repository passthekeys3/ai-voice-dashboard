import { NextRequest } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    badRequest,
    databaseError,
    apiSuccess,
    withErrorHandling,
} from '@/lib/api/response';
import { getStripe } from '@/lib/stripe';

// Admin client for auth user deletion (same pattern as clients/[id]/route.ts)
const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/account
 *
 * Permanently deletes the current user's agency and all associated data.
 * Requires agency_admin role and explicit confirmation body: { confirmation: "DELETE" }.
 *
 * Cleanup order:
 * 1. Cancel Stripe subscription (agency-level)
 * 2. Cancel all client Stripe subscriptions (Connect)
 * 3. Delete all auth users except current user
 * 4. Delete agency record (CASCADE handles: clients, agents, calls, phone_numbers,
 *    workflows, experiments, scheduled_calls, feedback, trigger logs)
 * 5. Delete current user's auth account
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    // Require explicit confirmation
    const body = await request.json();
    if (body.confirmation !== 'DELETE') {
        return badRequest('You must send { "confirmation": "DELETE" } to confirm account deletion');
    }

    const agencyId = user.agency.id;

    // ─── 1. Cancel agency Stripe subscription ───
    if (user.agency.subscription_id && process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = getStripe();
            await stripe.subscriptions.cancel(user.agency.subscription_id);
            console.info(`[ACCOUNT DELETE] Canceled agency subscription ${user.agency.subscription_id}`);
        } catch (stripeErr) {
            console.error(`[ACCOUNT DELETE] Failed to cancel agency subscription:`,
                stripeErr instanceof Error ? stripeErr.message : stripeErr);
            // Continue — subscription can be manually cleaned up in Stripe dashboard
        }
    }

    // ─── 2. Cancel all client Stripe subscriptions (Connect) ───
    if (user.agency.stripe_connect_account_id && process.env.STRIPE_SECRET_KEY) {
        try {
            const { data: clientsWithSubs } = await supabaseAdmin
                .from('clients')
                .select('id, stripe_subscription_id')
                .eq('agency_id', agencyId)
                .not('stripe_subscription_id', 'is', null);

            if (clientsWithSubs && clientsWithSubs.length > 0) {
                const stripe = getStripe();

                for (const client of clientsWithSubs) {
                    try {
                        await stripe.subscriptions.cancel(client.stripe_subscription_id!, {
                            stripeAccount: user.agency.stripe_connect_account_id!,
                        });
                    } catch (err) {
                        console.error(`[ACCOUNT DELETE] Failed to cancel client subscription ${client.stripe_subscription_id}:`,
                            err instanceof Error ? err.message : err);
                    }
                }
                console.info(`[ACCOUNT DELETE] Processed ${clientsWithSubs.length} client subscription(s)`);
            }
        } catch (err) {
            console.error(`[ACCOUNT DELETE] Error fetching client subscriptions:`,
                err instanceof Error ? err.message : err);
        }
    }

    // ─── 3. Delete all auth users for this agency (except current user) ───
    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('agency_id', agencyId);

    if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
            if (profile.id === user.id) continue; // Delete current user last

            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
            if (authError) {
                console.error(`[ACCOUNT DELETE] Failed to delete auth user ${profile.id}:`, authError.message);
            }
        }
        console.info(`[ACCOUNT DELETE] Deleted ${profiles.length - 1} auth user(s)`);
    }

    // ─── 4. Delete agency record (cascades all related data) ───
    const { error } = await supabaseAdmin
        .from('agencies')
        .delete()
        .eq('id', agencyId);

    if (error) {
        return databaseError(error);
    }

    console.info(`[ACCOUNT DELETE] Deleted agency ${agencyId}`);

    // ─── 5. Delete current user's auth account ───
    const { error: selfDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (selfDeleteError) {
        console.error(`[ACCOUNT DELETE] Failed to delete own auth user:`, selfDeleteError.message);
        // Agency is already gone — this is best-effort
    }

    return apiSuccess({ message: 'Account deleted' });
});
