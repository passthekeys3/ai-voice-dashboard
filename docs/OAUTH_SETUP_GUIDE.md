# OAuth Integration Setup Guide — Prosody Dashboard

## Overview
All OAuth code (routes, callbacks, token refresh, UI, database schema) is already built. This guide covers the **configuration steps** to activate GHL and HubSpot OAuth connections.

---

## Step 1: Create a GoHighLevel (GHL) OAuth App

1. Go to **https://marketplace.gohighlevel.com** → Sign in
2. Navigate to **"My Apps"** → Click **"Create App"**
3. Configure:
   - **Distribution type**: Private (internal use)
   - **Access level**: Location (Sub-Account)
4. In **Auth / Advanced Settings**, set your redirect URI:
   ```
   https://<your-vercel-domain>/api/auth/ghl/callback
   ```
5. Add these **scopes**:
   - `contacts.readonly`
   - `contacts.write`
   - `conversations.readonly`
   - `conversations.write`
   - `calendars.readonly`
   - `calendars.write`
   - `opportunities.readonly`
   - `opportunities.write`
6. Save and copy the **Client ID** and **Client Secret**

---

## Step 2: Create a HubSpot OAuth App

1. Go to **https://app.hubspot.com/developer** → Sign in / create developer account
2. Create a **Public App**
3. In the **Auth** tab, set your redirect URI:
   ```
   https://<your-vercel-domain>/api/auth/hubspot/callback
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
| `GHL_CLIENT_ID` | Your GHL Client ID from Step 1 |
| `GHL_CLIENT_SECRET` | Your GHL Client Secret from Step 1 |
| `GHL_REDIRECT_URI` | `https://<your-vercel-domain>/api/auth/ghl/callback` |
| `HUBSPOT_CLIENT_ID` | Your HubSpot Client ID from Step 2 |
| `HUBSPOT_CLIENT_SECRET` | Your HubSpot Client Secret from Step 2 |
| `HUBSPOT_REDIRECT_URI` | `https://<your-vercel-domain>/api/auth/hubspot/callback` |

> Replace `<your-vercel-domain>` with your actual Vercel deployment URL (e.g., `prosody-dashboard.vercel.app`)

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
2. Copy the **Webhook URL** shown (e.g., `https://<your-domain>/api/ghl/trigger-call`)
3. Copy the **Webhook Secret** (click to reveal)
4. In your CRM, create a workflow that sends a POST request to the webhook URL with the secret

---

## Architecture Reference

| Component | GHL | HubSpot |
|-----------|-----|---------|
| OAuth start | `GET /api/auth/ghl` | `GET /api/auth/hubspot` |
| OAuth callback | `GET /api/auth/ghl/callback` | `GET /api/auth/hubspot/callback` |
| Token refresh | `src/lib/integrations/ghl.ts` | `src/lib/integrations/hubspot.ts` |
| Webhook trigger | `POST /api/ghl/trigger-call` | `POST /api/hubspot/trigger-call` |
| UI | `src/components/dashboard/SettingsForm.tsx` | Same file |
| DB storage | `agencies.integrations` JSONB column | Same column |

---

## Troubleshooting

- **"Unauthorized" on connect**: Check that `GHL_CLIENT_ID` / `HUBSPOT_CLIENT_ID` env vars are set and the app is redeployed
- **Redirect URI mismatch**: The URI in Vercel env vars must exactly match what's registered in the CRM developer portal
- **Token expired**: Tokens auto-refresh. If refresh fails, disconnect and reconnect via Settings
- **Webhook not triggering**: Verify the webhook URL and secret are correctly configured in your CRM workflow
