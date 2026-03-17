# OAuth Integration Setup Guide — Prosody Dashboard

## Overview
All OAuth code (routes, callbacks, token refresh, SSO, UI, database schema) is already built. This guide covers the **configuration steps** to activate GHL and HubSpot OAuth connections.

---

## Step 1: Create a GoHighLevel Marketplace App

1. Go to **https://marketplace.gohighlevel.com** → Sign in / create developer account
2. Navigate to **"My Apps"** → Click **"Create App"**
3. Configure **App Details**:
   - **App Name**: BuildVoiceAI
   - **App Description**: AI voice agents that sync with your CRM — automate outbound calls, log results, book appointments, and trigger post-call workflows.
   - **Tagline**: AI Voice Agents for Agencies
   - **Company Name**: BuildVoiceAI
   - **Company Website**: https://buildvoiceai.com
   - **Logo**: Upload the 800×800 PNG from `~/Desktop/buildvoiceai-logo-800.png`
   - **Categories**: Automation, Phone/VoIP
4. Configure **Distribution**:
   - **Distribution type**: Public (Marketplace listing) — or Private to start
   - **Target user**: Sub-account
   - **Installation permissions**: Agencies & Sub-account
5. Configure **Auth / Advanced Settings**:
   - **Redirect URI**:
     ```
     https://buildvoiceai.com/api/auth/crm/callback
     ```
   - **SSO Key**: Click "Generate" — save this value for `GHL_APP_SSO_KEY` env var
6. Add these **scopes** (select all in the GHL portal):
   - `contacts.readonly`, `contacts.write`
   - `conversations.readonly`, `conversations.write`
   - `conversations/message.readonly`, `conversations/message.write`
   - `calendars.readonly`, `calendars.write`
   - `calendars/events.readonly`, `calendars/events.write`
   - `opportunities.readonly`, `opportunities.write`
   - `workflows.readonly`
   - `locations.readonly`
   - `locations/customValues.readonly`, `locations/customValues.write`
   - `locations/customFields.readonly`, `locations/customFields.write`
   - `locations/tags.readonly`, `locations/tags.write`
   - `users.readonly`
7. Under **Client Keys**, click **"+ Add"** to generate a Client ID and Client Secret
8. Under **Shared Secret**, click **"Generate key"** and save it

---

## Step 2: Create a HubSpot OAuth App

1. Go to **https://app.hubspot.com/developer** → Sign in / create developer account
2. Create a **Public App**
3. In the **Auth** tab, set your redirect URI:
   ```
   https://buildvoiceai.com/api/auth/hubspot/callback
   ```
4. Add these **scopes**:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
5. Save and copy the **Client ID** and **Client Secret**

---

## Step 3: Add Environment Variables in Vercel

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `GHL_CLIENT_ID` | Client ID from Step 1.7 |
| `GHL_CLIENT_SECRET` | Client Secret from Step 1.7 |
| `GHL_REDIRECT_URI` | `https://buildvoiceai.com/api/auth/crm/callback` |
| `GHL_APP_SSO_KEY` | SSO Key from Step 1.5 |
| `HUBSPOT_CLIENT_ID` | Client ID from Step 2 |
| `HUBSPOT_CLIENT_SECRET` | Client Secret from Step 2 |
| `HUBSPOT_REDIRECT_URI` | `https://buildvoiceai.com/api/auth/hubspot/callback` |

After adding the env vars, **redeploy** your app (push a commit or trigger manually from Vercel dashboard).

---

## Step 4: Connect via the Dashboard

1. Open your Prosody Dashboard → Go to **Settings**
2. **GHL**: Under the GoHighLevel section → Click **"Connect with GoHighLevel"** → Authorize in the GHL popup → Redirects back to Settings showing "Connected"
3. **HubSpot**: Under the HubSpot section → Click **"Connect HubSpot"** → Authorize in the HubSpot popup → Redirects back to Settings showing "Connected"

---

## Step 5: Configure Webhook Triggers (Optional)

After connecting, you can set up webhook triggers so GHL/HubSpot workflows automatically initiate AI voice calls:

1. In Settings, enable the **Trigger Configuration** toggle for each CRM
2. Copy the **Webhook URL** shown (e.g., `https://buildvoiceai.com/api/ghl/trigger-call`)
3. Copy the **Webhook Secret** (click to reveal)
4. In your CRM, create a workflow that sends a POST request to the webhook URL with the secret

---

## Architecture Reference

| Component | GHL | HubSpot |
|-----------|-----|---------|
| OAuth start | `GET /api/auth/crm` | `GET /api/auth/hubspot` |
| OAuth callback | `GET /api/auth/crm/callback` | `GET /api/auth/hubspot/callback` |
| SSO decrypt | `POST /api/auth/crm/sso` | N/A |
| Token refresh | `src/lib/integrations/ghl.ts` | `src/lib/integrations/hubspot.ts` |
| Webhook trigger | `POST /api/ghl/trigger-call` | `POST /api/hubspot/trigger-call` |
| UI | `src/components/dashboard/IntegrationsPage.tsx` | Same file |
| DB storage | `agencies.integrations` JSONB column | Same column |

### GHL OAuth Scopes Requested

| Scope | Used For |
|-------|----------|
| `contacts.readonly/write` | Search, create, update contacts after calls |
| `conversations.readonly/write` | Log call notes and messages |
| `conversations/message.readonly/write` | Read and send conversation messages |
| `calendars.readonly/write` | List calendars, check availability |
| `calendars/events.readonly/write` | Book appointments from voice agent |
| `opportunities.readonly/write` | Update pipeline stages post-call |
| `workflows.readonly` | Trigger post-call automation workflows |
| `locations.readonly` | Read location context for multi-location support |
| `locations/customValues.readonly/write` | Read and set location custom values |
| `locations/customFields.readonly/write` | Read and manage custom fields |
| `locations/tags.readonly/write` | Read and manage contact tags |
| `users.readonly` | Read user context for SSO and assignment |

### GHL SSO Flow (Marketplace iframe)

1. App loads in GHL iframe → frontend sends `REQUEST_USER_DATA` postMessage to parent
2. GHL parent responds with AES-256-CBC encrypted payload
3. Frontend POSTs encrypted payload to `POST /api/auth/crm/sso`
4. Backend decrypts with `GHL_APP_SSO_KEY` → returns user context (userId, email, role, locationId)

---

## Troubleshooting

- **"Unauthorized" on connect**: Check that `GHL_CLIENT_ID` / `HUBSPOT_CLIENT_ID` env vars are set and the app is redeployed
- **Redirect URI mismatch**: The URI in Vercel env vars must exactly match what's registered in the CRM developer portal
- **Token expired**: Tokens auto-refresh. If refresh fails, disconnect and reconnect via Settings
- **Webhook not triggering**: Verify the webhook URL and secret are correctly configured in your CRM workflow
- **SSO decrypt fails**: Verify `GHL_APP_SSO_KEY` matches the key in GHL portal > Advanced Settings > Auth
- **Marketplace review rejected**: Ensure no references to "HighLevel" or "GoHighLevel" in app properties or website
