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

grant usage on schema net to anon, authenticated, service_role;
grant execute on function net.http_post to anon, authenticated, service_role;

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
