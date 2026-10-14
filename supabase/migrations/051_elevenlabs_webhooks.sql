-- ElevenLabs post-call webhooks are registered per workspace (POST /v1/workspace/webhooks)
-- and signed with a secret ElevenLabs returns only once, at creation. The app registers
-- one webhook per ElevenLabs API key it uses (client, agency, or platform key) and keeps
-- the signing secret here, keyed by a SHA-256 hash of that API key so a rotated key
-- gets a fresh webhook automatically.
--
-- Only the service role reads or writes this table: RLS is on with no policies.

create table if not exists elevenlabs_webhooks (
    api_key_hash text primary key,
    webhook_id text not null,
    webhook_secret text not null, -- encrypted by the app (src/lib/crypto.ts)
    created_at timestamptz not null default now()
);

alter table elevenlabs_webhooks enable row level security;
