-- pg_cron jobs for cleanup that nothing else in the app currently does.
--
-- 1. Payments left 'pending' forever. create-checkout-session inserts a
--    'pending' payments row before redirecting to Stripe; stripe-webhook
--    flips it to 'completed' once Stripe confirms. If the student abandons
--    checkout, Stripe's own session simply expires (24h) and no webhook
--    ever fires for it, so the row would otherwise sit as 'pending'
--    indefinitely with no way to tell "still checking out" from "gave up".
-- 2. ai_tutor_requests rows are only ever queried for a trailing 1-hour
--    rate-limit window (kairos-mind-tutor) — nothing reads rows older than
--    that, so the table (and its index) grows forever for no benefit.
create extension if not exists pg_cron;

create or replace function expire_stale_payments()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update payments
  set status = 'failed'
  where status = 'pending'
    and created_at < now() - interval '24 hours';
end;
$$;

create or replace function prune_old_ai_tutor_requests()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  delete from ai_tutor_requests where created_at < now() - interval '7 days';
end;
$$;

select cron.schedule('expire-stale-payments', '0 * * * *', $$select expire_stale_payments()$$);
select cron.schedule('prune-ai-tutor-requests', '0 3 * * *', $$select prune_old_ai_tutor_requests()$$);
