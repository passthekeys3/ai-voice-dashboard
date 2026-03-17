/**
 * Communication action handlers: SMS, Email, Slack
 */

import type { WorkflowAction } from '@/types';
import type { CallData, ActionHandlerResult } from './types';
import { resolveTemplate, escapeHtml, EXTERNAL_API_TIMEOUT } from '../executor';

export async function handleSendSms(
    action: WorkflowAction,
    callData: CallData,
): Promise<ActionHandlerResult> {
    const rawConfig = action.config as Record<string, string>;
    const to = resolveTemplate(rawConfig.to || '{{from_number}}', callData);
    const message = resolveTemplate(rawConfig.message || '', callData);

    if (!to || !message) {
        return { success: false, error: 'SMS recipient or message not configured' };
    }

    // Validate phone number format (E.164: must start with +)
    if (!to.match(/^\+[1-9]\d{1,14}$/)) {
        return { success: false, error: 'Invalid phone number format for SMS recipient' };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        return { success: false, error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' };
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const smsResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Body: message.substring(0, 1600), // SMS body limit
        }),
        signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT),
    });

    if (!smsResponse.ok) {
        console.error(`Twilio SMS error: ${smsResponse.status}`);
        return { success: false, error: `SMS send failed: ${smsResponse.status}` };
    }

    console.log('SMS sent successfully');
    return { success: true };
}

export async function handleSendEmail(
    action: WorkflowAction,
    callData: CallData,
): Promise<ActionHandlerResult> {
    const rawConfig = action.config as Record<string, string>;
    // Sanitize resolved values to prevent header injection
    const to = resolveTemplate(rawConfig.to || '', callData).replace(/[\r\n]/g, '').trim();
    const subject = resolveTemplate(rawConfig.subject || '', callData).replace(/[\r\n]/g, '').trim();
    // HTML-escape template variable values before injecting into the email body
    // to prevent HTML/script injection from call data (e.g., transcript, summary)
    const emailBodyTemplate = rawConfig.body || '';
    const emailVars: Record<string, string> = {
        '{{call_id}}': escapeHtml(callData.call_id || ''),
        '{{agent_name}}': escapeHtml(callData.agent_name || ''),
        '{{status}}': escapeHtml(callData.status || ''),
        '{{direction}}': escapeHtml(callData.direction || ''),
        '{{duration}}': escapeHtml(String(callData.duration_seconds || 0)),
        '{{duration_minutes}}': escapeHtml(String(Math.round((callData.duration_seconds || 0) / 60))),
        '{{from_number}}': escapeHtml(callData.from_number || ''),
        '{{to_number}}': escapeHtml(callData.to_number || ''),
        '{{summary}}': escapeHtml(callData.summary || ''),
        '{{sentiment}}': escapeHtml(callData.sentiment || ''),
        '{{recording_url}}': escapeHtml(callData.recording_url || ''),
    };
    let body = emailBodyTemplate;
    for (const [key, value] of Object.entries(emailVars)) {
        body = body.replaceAll(key, value);
    }

    if (!to || !subject) {
        return { success: false, error: 'Email recipient or subject not configured' };
    }

    // Validate email format (stricter: single @, valid domain chars, 2+ char TLD)
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(to)) {
        return { success: false, error: 'Invalid email address format' };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@buildvoiceai.com';

    if (!resendApiKey) {
        return { success: false, error: 'Resend not configured. Set RESEND_API_KEY.' };
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject,
            html: body || `<p>${subject}</p>`,
        }),
        signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT),
    });

    if (!emailResponse.ok) {
        console.error(`Resend email error: ${emailResponse.status}`);
        return { success: false, error: `Email send failed: ${emailResponse.status}` };
    }

    console.log('Email sent successfully');
    return { success: true };
}

export async function handleSendSlack(
    action: WorkflowAction,
    callData: CallData,
): Promise<ActionHandlerResult> {
    const { sendSlackMessage, buildCallNotificationBlocks, isValidSlackWebhookUrl } = await import('@/lib/integrations/slack');
    const rawConfig = action.config as Record<string, string>;

    // Webhook URL from action config or agency default (passed via metadata)
    const webhookUrl = rawConfig.webhook_url ||
        (callData.metadata?.slack_webhook_url as string);

    if (!webhookUrl) {
        return { success: false, error: 'Slack webhook URL not configured. Set it in Settings or in the action config.' };
    }

    if (!isValidSlackWebhookUrl(webhookUrl)) {
        return { success: false, error: 'Invalid Slack webhook URL' };
    }

    const messageTemplate = rawConfig.message_template
        ? resolveTemplate(rawConfig.message_template, callData)
        : undefined;

    const payload = buildCallNotificationBlocks({
        call_id: callData.call_id,
        agent_name: callData.agent_name,
        status: callData.status,
        direction: callData.direction,
        duration_seconds: callData.duration_seconds,
        from_number: callData.from_number,
        to_number: callData.to_number,
        summary: callData.summary,
        sentiment: callData.sentiment,
        recording_url: callData.recording_url,
    }, messageTemplate);

    const slackResult = await sendSlackMessage(webhookUrl, payload);
    if (!slackResult.success) {
        return { success: false, error: slackResult.error };
    }

    console.log(`Slack notification sent for call ${callData.call_id}`);
    return { success: true };
}
