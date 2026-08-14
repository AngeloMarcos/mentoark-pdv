-- Bootstrap minimo de auto-hospedagem: recria as pecas que no Supabase
-- Cloud vem prontas (roles, schema auth, funcoes auth.uid()/role()/email()).
-- Baseado nos init-scripts oficiais de github.com/supabase/postgres.
--
-- Ordem de aplicacao (ver infra/README.md):
--   1. Este arquivo
--   2. Subir o container "auth" (GoTrue) uma vez, pra ele criar o
--      schema auth.* (users, sessions, etc.) com as proprias migrations dele
--   3. 01-storage-stub.sql
--   4. supabase/migrations/*.sql, em ordem, com os patches manuais
--      documentados no README (auth.users ainda nao existe antes do
--      passo 2; system_users tem um INSERT com UUID fixo do Supabase
--      Cloud que deve ser pulado; storage.foldername precisa existir
--      antes da migration que cria as policies de storage.objects)

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password '__AUTHENTICATOR_PASSWORD__';
  end if;
  -- GoTrue grava "grant ... to postgres" nas proprias migrations internas;
  -- so precisa existir, nao precisa ser superuser.
  if not exists (select 1 from pg_roles where rolname = 'postgres') then
    create role postgres noinherit;
  end if;
end $$;

grant anon to authenticator;
grant authenticated to authenticator;
grant service_role to authenticator;

-- Troque "mentoark" pelo superusuario real do seu Postgres compartilhado.
grant usage on schema public to mentoark, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to mentoark, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to mentoark, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to mentoark, anon, authenticated, service_role;
grant all privileges on all tables in schema public to mentoark, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'role', '')::text
$$ language sql stable;

create or replace function auth.email() returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'email', '')::text
$$ language sql stable;
