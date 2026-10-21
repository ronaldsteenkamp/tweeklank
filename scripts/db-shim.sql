-- Minimale nabootsing van wat Supabase standaard klaarzet, zodat migraties en pgTAP-tests
-- ook zonder Docker op een gewone PostgreSQL kunnen draaien (zie scripts/test-db.sh).
-- In een echt Supabase-project (of `supabase test db`) is dit bestand NIET nodig.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id          uuid primary key,
  email       text,
  created_at  timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create extension if not exists pgtap;
