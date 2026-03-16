# Webhook Integration Guide — Prosody Dashboard

Connect Prosody to Zapier, Make (Integromat), n8n, or any webhook-compatible tool to trigger automations when calls start and end.

---

## Overview

Prosody forwards real-time call events to any HTTPS webhook URL you configure. This lets you connect to thousands of apps without writing code.

**Supported events:**

| Event | When it fires | Providers |
|-------|---------------|-----------|
| `call_started` | A call begins ringing/connecting | Retell, Vapi |
| `call_ended` | A call finishes (completed, failed, or no-answer) | Retell, Vapi, Bland |
| `test` | Manual test from Settings | All |

> **Note:** Bland AI only fires webhooks on call completion — there is no `call_started` event for Bland.

---

## Step 1: Configure Your Webhook URL

1. Open **Settings** (agency-level) or a **Client detail page** (client-level)
2. Scroll to **API & Webhooks**
3. Paste your webhook URL (must be HTTPS)
4. Click **Save**

Client-level webhooks override agency defaults. If a client has its own webhook URL, call events for that client's agents are sent there instead.

---

## Step 2: Send a Test Webhook

After saving your webhook URL, click the **Send Test Webhook** button. This sends a sample `call_ended` payload so you can verify your integration receives data correctly.

The test payload includes all the same fields as a real call event, with `"test": true` set so your automation can distinguish test from live data.

---

## Step 3: (Optional) Enable Webhook Signing

For production use, enable HMAC-SHA256 signing to verify payloads are authentically from Prosody:

1. In **API & Webhooks**, a signing secret is auto-generated when you save
2. Copy the **Webhook Signing Secret** (click the eye icon to reveal)
3. Use it in your receiving app to verify signatures

### Signature Verification

Every signed webhook includes two headers:

| Header | Description |
|--------|-------------|
| `X-Prosody-Signature` | HMAC-SHA256 hex digest |
| `X-Prosody-Timestamp` | Unix timestamp (seconds) |

The signature is computed as:

```
HMAC-SHA256(signing_secret, "${timestamp}.${body}")
```

**Verification pseudocode:**

```javascript
const crypto = require('crypto');

function verifyWebhook(body, signature, timestamp, secret) {
    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}
```

**Recommended:** Reject payloads older than 5 minutes to prevent replay attacks:

```javascript
const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
if (age > 300) throw new Error('Webhook too old');
```

---

## Webhook Payload Reference

### `call_started` Event

```json
{
    "event": "call_started",
    "call_id": "call_abc123",
    "agent_id": "uuid",
    "agent_name": "Sales Agent",
    "status": "in-progress",
    "direction": "inbound",
    "from_number": "+14155551234",
    "to_number": "+14155555678",
    "started_at": "2026-03-16T14:30:00.000Z",
    "metadata": {},
    "provider": "vapi"
}
```

### `call_ended` Event

```json
{
    "event": "call_ended",
    "call_id": "call_abc123",
    "agent_id": "uuid",
    "agent_name": "Sales Agent",
    "status": "completed",
    "direction": "inbound",
    "duration_seconds": 185,
    "cost_cents": 28,
    "from_number": "+14155551234",
    "to_number": "+14155555678",
    "transcript": "Agent: Hello...\nUser: Hi...",
    "recording_url": "https://...",
    "summary": "Caller inquired about pricing...",
    "sentiment": "positive",
    "started_at": "2026-03-16T14:30:00.000Z",
    "ended_at": "2026-03-16T14:33:05.000Z",
    "metadata": {},
    "provider": "retell"
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `call_started`, `call_ended`, or `test` |
| `call_id` | string | Unique call identifier |
| `agent_id` | string | Prosody agent UUID |
| `agent_name` | string | Human-readable agent name |
| `status` | string | `in-progress`, `completed`, `failed`, `no-answer` |
| `direction` | string | `inbound` or `outbound` |
| `duration_seconds` | number | Call length (only on `call_ended`) |
| `cost_cents` | number | Call cost in cents (only on `call_ended`) |
| `from_number` | string | Caller phone number (E.164) |
| `to_number` | string | Recipient phone number (E.164) |
| `transcript` | string | Full conversation transcript (only on `call_ended`) |
| `recording_url` | string\|null | Link to call recording (only on `call_ended`) |
| `summary` | string | AI-generated call summary (only on `call_ended`) |
| `sentiment` | string | `positive`, `neutral`, or `negative` (only on `call_ended`) |
| `started_at` | string | ISO 8601 timestamp |
| `ended_at` | string | ISO 8601 timestamp (only on `call_ended`) |
| `metadata` | object | Custom metadata attached to the call |
| `provider` | string | `retell`, `vapi`, `bland`, or `test` |
| `test` | boolean | Only present on test webhooks (`true`) |

---

## Platform-Specific Setup

### Zapier

1. Create a new Zap with **Webhooks by Zapier** as the trigger
2. Choose **Catch Hook**
3. Copy the webhook URL Zapier gives you (e.g., `https://hooks.zapier.com/hooks/catch/...`)
4. Paste it into Prosody Settings → API & Webhooks → Webhook URL
5. Click **Send Test Webhook** in Prosody
6. In Zapier, click **Test trigger** — you should see the test payload
7. Add your actions (CRM update, Slack message, email, etc.)

### Make (Integromat)

1. Create a new scenario
2. Add a **Webhooks > Custom webhook** module
3. Copy the URL Make generates
4. Paste it into Prosody Settings → Webhook URL
5. Click **Send Test Webhook** in Prosody
6. In Make, click **Re-determine data structure** — Make auto-maps the fields
7. Add subsequent modules for your automation

### n8n

1. Create a new workflow
2. Add a **Webhook** trigger node
3. Set method to **POST** and copy the **Production URL**
4. Paste it into Prosody Settings → Webhook URL
5. Click **Send Test Webhook** in Prosody
6. In n8n, check the webhook node output — all fields should be mapped
7. Build your workflow with the parsed call data

### Custom HTTP Endpoint

Any service that accepts HTTPS POST requests with JSON bodies works. Ensure your endpoint:
- Responds with a `2xx` status code on success
- Responds within 10 seconds (Prosody's timeout)
- Handles duplicate deliveries idempotently (use `call_id` as a dedup key)

---

## Delivery & Retries

Prosody automatically retries failed deliveries:

| Attempt | Delay | Condition |
|---------|-------|-----------|
| 1st | Immediate | Always |
| 2nd | 1 second | On 5xx, 429, or network error |
| 3rd | 2 seconds | On 5xx, 429, or network error |

**Not retried:** 4xx errors (except 429) indicate a permanent problem (bad URL, auth failure).

### Delivery Log

View recent webhook deliveries in **Settings → API & Webhooks → Recent Deliveries**. Each entry shows:
- Event type and timestamp
- HTTP status code
- Success/failure status
- Error message (if failed)
- Attempt number

---

## Security

- **HTTPS only** — HTTP URLs are rejected
- **SSRF protection** — Private IPs, localhost, and internal addresses are blocked
- **HMAC signing** — Optional but recommended for production
- **Timing-safe comparison** — Signature verification uses constant-time comparison
- **User-Agent** — All requests include `Prosody-Webhook/1.0`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Test webhook not received | Check that the URL is HTTPS and publicly accessible |
| 401/403 errors | Your receiving endpoint requires authentication — add auth headers or use a public webhook URL |
| Timeouts | Ensure your endpoint responds within 10 seconds |
| Missing fields | `call_started` events have fewer fields than `call_ended` — check the payload reference above |
| No `call_started` for Bland | Expected — Bland only fires on call completion |
| Duplicate deliveries | Use `call_id` + `event` as a dedup key in your automation |
| Signature mismatch | Ensure you're using the raw request body (not parsed JSON) for verification |

---

## Architecture Reference

| Component | Path |
|-----------|------|
| Webhook forwarding module | `src/lib/webhooks/forward.ts` |
| URL validation & signing | `src/lib/webhooks/validation.ts` |
| Test endpoint | `POST /api/webhooks/test` |
| Delivery log API | `GET /api/webhook-deliveries` |
| Retell webhook handler | `POST /api/webhooks/retell` |
| Vapi webhook handler | `POST /api/webhooks/vapi` |
| Bland webhook handler | `POST /api/webhooks/bland` |
| UI component | `src/components/dashboard/ApiWebhooksConfig.tsx` |
| DB table | `webhook_delivery_log` (migration 045) |
