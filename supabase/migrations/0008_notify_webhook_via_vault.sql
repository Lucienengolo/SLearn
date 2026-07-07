-- Fixes a real bug in 0004_reviewer_and_notifications.sql, found by actually
-- deploying to a live Supabase Cloud project rather than only testing
-- against local/stub Postgres: 0004's documented one-time setup step
-- (`alter database postgres set app.settings.notify_webhook_url = ...`) does
-- NOT work on Supabase Cloud — it raises `permission denied to set
-- parameter` (42501) even for the `postgres` role, which the hosted platform
-- restricts from setting arbitrary custom GUCs. It only ever worked against
-- local Postgres (which grants postgres real superuser rights), so this was
-- silently broken on every real deployment: the notify triggers would have
-- run, found both settings null, and no-op'd forever.
--
-- Fix: read the webhook URL/secret from Supabase Vault (supabase_vault,
-- preinstalled on every Supabase Cloud project) instead of custom GUCs.
-- Vault's decrypted view is locked down to service_role by RLS, so these
-- functions need SECURITY DEFINER to read it — the same pattern already
-- used by handle_new_user() in 0005, and just as narrow: the function does
-- nothing else with the elevated privilege.
--
-- The actual secret values are NOT set here (a migration file is committed
-- to version control) — they're created directly against the live project
-- via `vault.create_secret(...)`, run once, out of band. See README §6 DO-4
-- for the exact one-time command.
create or replace function notify_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  if new.status = 'submitted' and old.status is distinct from new.status then
    select decrypted_secret into webhook_url from vault.decrypted_secrets where name = 'notify_webhook_url';
    if webhook_url is not null then
      select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'notify_webhook_secret';
      perform net.http_post(
        url := webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(webhook_secret, '')),
        body := jsonb_build_object('event', 'application_submitted', 'application_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function notify_interview_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  select decrypted_secret into webhook_url from vault.decrypted_secrets where name = 'notify_webhook_url';
  if webhook_url is not null then
    select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'notify_webhook_secret';
    perform net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(webhook_secret, '')),
      body := jsonb_build_object('event', 'interview_scheduled', 'interview_id', new.id)
    );
  end if;
  return new;
end;
$$;

-- Both functions already had triggers created in 0004 (create trigger ...
-- for each row execute function ...) — replacing the function body in place
-- via create or replace function does not require recreating the triggers.

-- Same search_path hardening as 0007, now that these functions' bodies
-- changed (0007 pinned the *previous* body's search_path; re-stating it here
-- for the new body, which additionally needs the vault schema on the path).
