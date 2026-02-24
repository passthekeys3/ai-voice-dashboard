import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import {
    unauthorized,
    created,
    validateRequest,
    badRequest,
    databaseError,
    withErrorHandling,
} from '@/lib/api/response';
import { sendEmail } from '@/lib/email/send';
import { escapeHtml } from '@/lib/email/templates';

const VALID_FEEDBACK_TYPES = ['bug', 'feature_request', 'general'] as const;

const FEEDBACK_NOTIFY_EMAIL = process.env.FEEDBACK_NOTIFY_EMAIL || 'kevin@buildvoiceai.com';

export const POST = withErrorHandling(async (request: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    const body = await request.json();
    const { type, title, description, page_url, browser_info } = body;

    // Validate required fields
    const validationError = validateRequest([
        { field: 'type', value: type, required: true, type: 'string' },
        { field: 'title', value: title, required: true, type: 'string', minLength: 1, maxLength: 200 },
        { field: 'description', value: description, required: true, type: 'string', minLength: 1, maxLength: 5000 },
    ]);
    if (validationError) return validationError;

    if (!VALID_FEEDBACK_TYPES.includes(type)) {
        return badRequest(`Invalid feedback type. Must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}`);
    }

    if (page_url && (typeof page_url !== 'string' || page_url.length > 2048)) {
        return badRequest('Invalid page URL');
    }
    if (browser_info && (typeof browser_info !== 'string' || browser_info.length > 500)) {
        return badRequest('Invalid browser info');
    }

    const supabase = createServiceClient();

    const { data: feedback, error } = await supabase
        .from('feedback')
        .insert({
            agency_id: user.agency.id,
            user_id: user.id,
            user_email: user.email,
            type,
            title: title.trim(),
            description: description.trim(),
            page_url: page_url || null,
            browser_info: browser_info || null,
        })
        .select()
        .single();

    if (error) {
        return databaseError(error);
    }

    // Send email notification (feedback is already persisted — email is best-effort)
    const typeLabel = type === 'bug' ? 'Bug Report'
        : type === 'feature_request' ? 'Feature Request'
        : 'General Feedback';

    const safeTitle = escapeHtml(title.trim());
    const safeDescription = escapeHtml(description.trim()).replace(/\n/g, '<br />');
    const safeAgencyName = escapeHtml(user.agency.name);

    await sendEmail({
        to: FEEDBACK_NOTIFY_EMAIL,
        subject: `[Feedback] ${typeLabel}: ${title.trim()}`,
        html: `
            <h2>${typeLabel}</h2>
            <p><strong>From:</strong> ${escapeHtml(user.email)} (${safeAgencyName})</p>
            <p><strong>Title:</strong> ${safeTitle}</p>
            <hr />
            <p>${safeDescription}</p>
            <hr />
            <p style="color: #888; font-size: 12px;">
                Page: ${escapeHtml(page_url || 'N/A')}<br />
                Browser: ${escapeHtml(browser_info || 'N/A')}<br />
                Feedback ID: ${feedback.id}
            </p>
        `,
        text: `${typeLabel}\n\nFrom: ${user.email} (${user.agency.name})\nTitle: ${title.trim()}\n\n${description.trim()}\n\nPage: ${page_url || 'N/A'}\nBrowser: ${browser_info || 'N/A'}\nID: ${feedback.id}`,
        replyTo: user.email,
    });

    return created({ id: feedback.id });
});
