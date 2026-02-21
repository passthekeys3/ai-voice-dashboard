/**
 * Email Templates
 *
 * HTML email templates for transactional emails.
 * Uses inline styles for maximum email client compatibility.
 */

const APP_NAME = 'Prosody';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://buildvoiceai.com';

/** Escape user-supplied strings for safe insertion into HTML email templates. */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function layout(content: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
                    <!-- Header -->
                    <tr>
                        <td style="padding:32px 32px 0;text-align:center;">
                            <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">${APP_NAME}</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding:24px 32px 32px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
                            <p style="margin:0;font-size:13px;color:#94a3b8;">
                                ${APP_NAME} &mdash; AI Voice Agents for Agencies
                            </p>
                            <p style="margin:8px 0 0;font-size:12px;color:#cbd5e1;">
                                <a href="${APP_URL}" style="color:#94a3b8;text-decoration:none;">${APP_URL.replace('https://', '')}</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ─── Welcome Email ──────────────────────────────────────────────

export function welcomeEmail(params: {
    userName: string;
    agencyName: string;
    trialDays: number;
}): { subject: string; html: string; text: string } {
    const { userName, agencyName, trialDays } = params;
    const safeUserName = escapeHtml(userName);
    const safeAgencyName = escapeHtml(agencyName);

    return {
        subject: `Welcome to ${APP_NAME} — your trial is active`,
        html: layout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;">Welcome, ${safeUserName}!</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                Your agency <strong>${safeAgencyName}</strong> is set up with a <strong>${trialDays}-day free trial</strong>. Here&rsquo;s how to get started:
            </p>
            <ol style="margin:0 0 24px;padding-left:20px;font-size:15px;color:#334155;line-height:1.8;">
                <li>Connect your voice provider (Retell, Vapi, or Bland)</li>
                <li>Import or create your first agent</li>
                <li>Make a test call from the dashboard</li>
            </ol>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                    <td style="background-color:#0f172a;border-radius:8px;padding:12px 24px;">
                        <a href="${APP_URL}/onboarding" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
                            Set up your account &rarr;
                        </a>
                    </td>
                </tr>
            </table>
            <p style="margin:0;font-size:14px;color:#64748b;">
                Need help? Reply to this email and we&rsquo;ll get back to you.
            </p>
        `),
        text: `Welcome to ${APP_NAME}, ${userName}!\n\nYour agency "${agencyName}" is set up with a ${trialDays}-day free trial.\n\nGet started:\n1. Connect your voice provider (Retell, Vapi, or Bland)\n2. Import or create your first agent\n3. Make a test call\n\nSet up your account: ${APP_URL}/onboarding\n\nNeed help? Reply to this email.`,
    };
}

// ─── Trial Ending Soon ──────────────────────────────────────────

export function trialEndingEmail(params: {
    userName: string;
    daysRemaining: number;
}): { subject: string; html: string; text: string } {
    const { userName, daysRemaining } = params;
    const safeUserName = escapeHtml(userName);

    return {
        subject: `Your ${APP_NAME} trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        html: layout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;">Trial ending soon</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                Hi ${safeUserName}, your free trial ends in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>. Subscribe to keep your agents running.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                    <td style="background-color:#0f172a;border-radius:8px;padding:12px 24px;">
                        <a href="${APP_URL}/billing/upgrade" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
                            Choose a plan &rarr;
                        </a>
                    </td>
                </tr>
            </table>
            <p style="margin:0;font-size:14px;color:#64748b;">
                After your trial, you&rsquo;ll lose access to the dashboard until you subscribe.
            </p>
        `),
        text: `Hi ${userName}, your ${APP_NAME} trial ends in ${daysRemaining} day(s). Subscribe to keep your agents running: ${APP_URL}/billing/upgrade`,
    };
}

// ─── Payment Received ───────────────────────────────────────────

export function paymentReceivedEmail(params: {
    userName: string;
    planName: string;
    amount: string;
    invoiceUrl?: string;
}): { subject: string; html: string; text: string } {
    const { userName, planName, amount, invoiceUrl } = params;
    const safeUserName = escapeHtml(userName);
    const safePlanName = escapeHtml(planName);
    const safeAmount = escapeHtml(amount);

    return {
        subject: `Payment received — ${APP_NAME} ${planName}`,
        html: layout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;">Payment confirmed</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                Hi ${safeUserName}, we&rsquo;ve received your payment of <strong>${safeAmount}</strong> for the <strong>${safePlanName}</strong> plan.
            </p>
            ${invoiceUrl ? `
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                    <td style="background-color:#f1f5f9;border-radius:8px;padding:12px 24px;border:1px solid #e2e8f0;">
                        <a href="${invoiceUrl}" style="color:#0f172a;font-size:14px;font-weight:500;text-decoration:none;display:inline-block;">
                            View invoice &rarr;
                        </a>
                    </td>
                </tr>
            </table>
            ` : ''}
            <p style="margin:0;font-size:14px;color:#64748b;">
                Thank you for your business!
            </p>
        `),
        text: `Hi ${userName}, we've received your payment of ${amount} for the ${planName} plan.${invoiceUrl ? `\n\nView invoice: ${invoiceUrl}` : ''}\n\nThank you!`,
    };
}

// ─── Payment Failed ─────────────────────────────────────────────

export function paymentFailedEmail(params: {
    userName: string;
    planName: string;
    amount: string;
}): { subject: string; html: string; text: string } {
    const { userName, planName, amount } = params;
    const safeUserName = escapeHtml(userName);
    const safePlanName = escapeHtml(planName);
    const safeAmount = escapeHtml(amount);

    return {
        subject: `Action required — payment failed for ${APP_NAME}`,
        html: layout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#dc2626;">Payment failed</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                Hi ${safeUserName}, your payment of <strong>${safeAmount}</strong> for the <strong>${safePlanName}</strong> plan was declined. Please update your payment method to avoid service interruption.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                    <td style="background-color:#0f172a;border-radius:8px;padding:12px 24px;">
                        <a href="${APP_URL}/billing" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
                            Update payment method &rarr;
                        </a>
                    </td>
                </tr>
            </table>
            <p style="margin:0;font-size:14px;color:#64748b;">
                We&rsquo;ll retry the payment in a few days. If you need help, reply to this email.
            </p>
        `),
        text: `Hi ${userName}, your payment of ${amount} for the ${planName} plan was declined.\n\nUpdate your payment method: ${APP_URL}/billing\n\nWe'll retry in a few days. Reply to this email if you need help.`,
    };
}
