/**
 * Email sending utility using Resend
 *
 * Centralized email sender. All transactional emails go through here.
 * Gracefully no-ops when RESEND_API_KEY is not configured.
 */

import { Resend } from 'resend';
import { logError, logWarning } from '@/lib/error-logger';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Prosody <noreply@buildvoiceai.com>';

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
}

/**
 * Send a transactional email via Resend.
 * Returns true if sent successfully, false otherwise.
 * No-ops gracefully if Resend is not configured.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!resend) {
        logWarning('Email not sent — RESEND_API_KEY not configured', {
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
        });
        return false;
    }

    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: options.replyTo,
        });

        if (error) {
            logError(new Error(`Resend error: ${error.message}`), {
                action: 'send_email',
                metadata: { to: options.to, subject: options.subject },
            });
            return false;
        }

        return true;
    } catch (err) {
        logError(err, {
            action: 'send_email',
            metadata: { to: options.to, subject: options.subject },
        });
        return false;
    }
}
