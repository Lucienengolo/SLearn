-- CI-only stand-in for schemas/roles/extensions that a real Supabase
-- project provides but a plain `postgres` service container doesn't.
-- Never applied to a real Supabase project — that's what the actual
-- supabase/migrations/*.sql files are for. This just lets CI catch SQL
-- errors in those migrations (see .github/workflows/ci.yml, job "database").
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end
$$;

alter role service_role bypassrls;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
  $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);

create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

-- pg_net stand-in: real Supabase projects have the actual extension; CI
-- strips the `create extension pg_net` line from 0004 (see workflow) and
-- relies on this stub so the trigger functions that call net.http_post
-- still compile and can be exercised.
create schema if not exists net;

-- Real pg_net's composite types (confirmed directly against the live
-- project's pg_attribute catalog) -- needed because 0011/0012 declare
-- plpgsql variables of these types, and variable *declarations* are
-- type-resolved at CREATE FUNCTION time, not deferred like most of a
-- function body. Without these, those migrations fail to even compile
-- in CI, despite being valid on a real Supabase project.
create type net.request_status as enum ('PENDING', 'SUCCESS', 'ERROR');
create type net.http_response as (status_code integer, headers jsonb, body text);
create type net.http_response_result as (status net.request_status, message text, response net.http_response);

create or replace function net.http_post(
  url text,
  body jsonb default null,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000
) returns bigint
language plpgsql as $$
begin
  raise notice 'net.http_post called: url=%, headers=%, body=%', url, headers, body;
  return 1;
end;
$$;

create or replace function net.http_collect_response(request_id bigint, async boolean default true)
returns net.http_response_result
language plpgsql as $$
begin
  return row('SUCCESS'::net.request_status, null::text, row(200, '{}'::jsonb, '')::net.http_response)::net.http_response_result;
end;
$$;

grant usage on schema net to anon, authenticated, service_role;
grant execute on function net.http_post to anon, authenticated, service_role;
grant execute on function net.http_collect_response to anon, authenticated, service_role;

-- supabase_vault stand-in: real projects ship the actual extension
-- (encrypted at rest via pgsodium). This stub just mimics the interface
-- (create_secret + decrypted_secrets view) so migrations that read/write
-- vault secrets compile and can be exercised in CI — no real encryption.
create schema if not exists vault;

create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text not null default '',
  secret text not null,
  key_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view vault.decrypted_secrets as
  select id, name, description, secret as decrypted_secret, key_id, created_at, updated_at
  from vault.secrets;

create or replace function vault.create_secret(
  new_secret text,
  new_name text default null,
  new_description text default null,
  new_key_id uuid default null
) returns uuid
language plpgsql as $$
declare
  rec_id uuid;
begin
  insert into vault.secrets (name, description, secret, key_id)
  values (new_name, coalesce(new_description, ''), new_secret, new_key_id)
  returning id into rec_id;
  return rec_id;
end;
$$;

grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;
grant execute on function vault.create_secret to service_role;

-- pg_cron stand-in: real Supabase Cloud projects ship the actual
-- extension; CI strips `create extension pg_cron` (see workflow) and
-- relies on this stub so cron.schedule(...) calls in migrations compile
-- and can be exercised. Doesn't actually schedule anything.
create schema if not exists cron;

create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint
language plpgsql as $$
begin
  raise notice 'cron.schedule called: job_name=%, schedule=%', job_name, schedule;
  return 1;
end;
$$;

grant usage on schema cron to service_role;
grant execute on function cron.schedule(text, text, text) to service_role;

-- pgmq stand-in: real Supabase Cloud projects ship the actual extension;
-- CI strips `create extension pgmq` (see workflow) and relies on this
-- stub so the queue calls in migrations compile and can be exercised.
-- Minimal in-memory-via-table behavior, not the real thing.
create schema if not exists pgmq;

create table if not exists pgmq._stub_messages (
  msg_id bigserial primary key,
  queue_name text not null,
  message jsonb not null,
  read_ct int not null default 0
);

create or replace function pgmq.create(queue_name text) returns void
  language sql as $$ select 1 $$;

create or replace function pgmq.send(queue_name text, msg jsonb) returns bigint
language plpgsql as $$
declare
  new_id bigint;
begin
  insert into pgmq._stub_messages (queue_name, message) values (queue_name, msg) returning msg_id into new_id;
  return new_id;
end;
$$;

create or replace function pgmq.read(queue_name text, vt int, qty int)
returns table (msg_id bigint, read_ct int, message jsonb)
language sql as $$
  select msg_id, read_ct, message from pgmq._stub_messages where queue_name = $1 limit qty;
$$;

create or replace function pgmq.delete(queue_name text, msg_id bigint) returns boolean
language plpgsql as $$
begin
  delete from pgmq._stub_messages where msg_id = $2;
  return true;
end;
$$;

create or replace function pgmq.archive(queue_name text, msg_id bigint) returns boolean
language plpgsql as $$
begin
  delete from pgmq._stub_messages where msg_id = $2;
  return true;
end;
$$;

grant usage on schema pgmq to service_role;
grant all on pgmq._stub_messages to service_role;
grant all on sequence pgmq._stub_messages_msg_id_seq to service_role;
grant execute on function pgmq.create(text) to service_role;
grant execute on function pgmq.send(text, jsonb) to service_role;
grant execute on function pgmq.read(text, int, int) to service_role;
grant execute on function pgmq.delete(text, bigint) to service_role;
grant execute on function pgmq.archive(text, bigint) to service_role;
