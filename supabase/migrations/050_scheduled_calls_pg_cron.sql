-- Run /api/cron/process-scheduled-calls every 5 minutes from the database.
--
-- Vercel's Hobby plan allows each cron to run at most once a day, which is too
-- slow for scheduled outbound calls. vercel.json keeps a daily run as a safety
-- net; this job provides the 5-minute cadence. Overlapping runs are safe: the
-- route claims each call with an optimistic lock (status pending -> in_progress).
--
-- ONE-TIME SETUP (run in the SQL editor; values are not stored in this file):
--   select vault.create_secret('https://your-app-domain.com', 'app_url');
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'cron_secret');
-- Until both secrets exist the job runs but sends nothing.
--
-- Check it's working:
--   select * from cron.job_run_details where jobid = (
--     select jobid from cron.job where jobname = 'process-scheduled-calls'
--   ) order by start_time desc limit 10;
--   select status_code, created from net._http_response order by created desc limit 10;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Re-runnable: replace any existing job with this name
select cron.unschedule(jobid) from cron.job where jobname = 'process-scheduled-calls';

select cron.schedule(
    'process-scheduled-calls',
    '*/5 * * * *',
    $$
    select net.http_post(
        url := s.app_url || '/api/cron/process-scheduled-calls',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || s.cron_secret,
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    )
    from (
        select
            (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') as app_url,
            (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as cron_secret
    ) s
    where s.app_url is not null and s.cron_secret is not null;
    $$
);
