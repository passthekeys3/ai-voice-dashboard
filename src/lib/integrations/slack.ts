/**
 * Slack Integration — Incoming Webhooks
 *
 * Sends rich Block Kit notifications to Slack channels.
 * Uses Incoming Webhooks (no OAuth needed — user pastes webhook URL).
 */

// ============================================================================
// Types
// ============================================================================

interface SlackTextObject {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
}

interface SlackBlock {
    type: 'header' | 'section' | 'divider' | 'context';
    text?: SlackTextObject;
    fields?: SlackTextObject[];
    elements?: SlackTextObject[];
}

interface SlackPayload {
    text: string;       // Fallback text for notifications
    blocks: SlackBlock[];
}

export interface CallNotificationData {
    call_id?: string;
    agent_name?: string;
    status?: string;
    direction?: string;
    duration_seconds?: number;
    from_number?: string;
    to_number?: string;
    summary?: string;
    sentiment?: string;
    call_score?: number;
    recording_url?: string;
    contact_name?: string;
}

// ============================================================================
// URL Validation
// ============================================================================

const ALLOWED_WEBHOOK_PREFIXES = [
    'https://hooks.slack.com/',
    'https://hooks.slack-gov.com/',
];

export function isValidSlackWebhookUrl(url: string): boolean {
    return ALLOWED_WEBHOOK_PREFIXES.some(prefix => url.startsWith(prefix));
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Send a message to a Slack Incoming Webhook
 */
export async function sendSlackMessage(
    webhookUrl: string,
    payload: SlackPayload,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidSlackWebhookUrl(webhookUrl)) {
        return { success: false, error: 'Invalid Slack webhook URL' };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error(`Slack webhook returned ${response.status}: ${text}`);
            return { success: false, error: `Slack webhook failed with status ${response.status}` };
        }

        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: `Slack webhook failed: ${message}` };
    }
}

/**
 * Build Block Kit blocks for a call notification
 */
export function buildCallNotificationBlocks(
    data: CallNotificationData,
    customMessage?: string,
): SlackPayload {
    const direction = data.direction === 'inbound' ? 'Inbound' : 'Outbound';
    const durationMin = data.duration_seconds ? (data.duration_seconds / 60).toFixed(1) : '0';
    const sentimentEmoji = data.sentiment === 'positive' ? ':large_green_circle:'
        : data.sentiment === 'negative' ? ':red_circle:'
        : ':white_circle:';
    const statusEmoji = data.status === 'completed' ? ':white_check_mark:'
        : data.status === 'failed' ? ':x:'
        : ':hourglass:';
    const phoneDisplay = data.direction === 'inbound'
        ? (data.from_number || 'Unknown')
        : (data.to_number || 'Unknown');

    const fallbackText = `${direction} call with ${data.agent_name || 'Unknown Agent'} — ${data.status || 'unknown'}`;

    // If custom message provided, send simple message
    if (customMessage) {
        return {
            text: fallbackText,
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: customMessage },
                },
            ],
        };
    }

    const blocks: SlackBlock[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${statusEmoji} ${direction} Call — ${data.status || 'unknown'}`,
                emoji: true,
            },
        },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Agent:*\n${data.agent_name || 'Unknown'}` },
                { type: 'mrkdwn', text: `*Phone:*\n${phoneDisplay}` },
                { type: 'mrkdwn', text: `*Duration:*\n${durationMin} min` },
                { type: 'mrkdwn', text: `*Sentiment:*\n${sentimentEmoji} ${data.sentiment || 'N/A'}` },
            ],
        },
    ];

    // Add contact name if available
    if (data.contact_name) {
        blocks.push({
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Contact:*\n${data.contact_name}` },
                { type: 'mrkdwn', text: `*Score:*\n${data.call_score != null ? `${data.call_score}/100` : 'N/A'}` },
            ],
        });
    }

    // Add summary if available
    if (data.summary) {
        blocks.push(
            { type: 'divider' },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Summary:*\n${data.summary.length > 500 ? data.summary.slice(0, 500) + '...' : data.summary}`,
                },
            },
        );
    }

    return { text: fallbackText, blocks };
}

/**
 * Send a test message to verify the webhook works
 */
export async function testSlackWebhook(
    webhookUrl: string,
): Promise<{ success: boolean; error?: string }> {
    const payload: SlackPayload = {
        text: 'BuildVoiceAI — Test notification',
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: ':white_check_mark: BuildVoiceAI Connected!', emoji: true },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: 'Your Slack integration is working. Call notifications will appear here when workflows trigger.',
                },
            },
        ],
    };

    return sendSlackMessage(webhookUrl, payload);
}

/**
 * Build a simple alert message (for payment failures, system alerts, etc.)
 */
export function buildAlertPayload(title: string, message: string): SlackPayload {
    return {
        text: `${title}: ${message}`,
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: `:warning: ${title}`, emoji: true },
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: message },
            },
        ],
    };
}
