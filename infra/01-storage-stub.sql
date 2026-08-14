-- Stub minimo do schema storage.* (buckets/objects + funcoes auxiliares
-- foldername/filename/extension) para as RLS policies de storage.objects
-- (product-images) terem onde se prender. Nao substitui o servico
-- storage-api de verdade — upload/download de arquivo so funciona
-- quando esse servico for adicionado (ver infra/README.md, secao
-- "Pendente: Storage/Realtime").

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

grant all on storage.buckets to service_role;
grant all on storage.objects to service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

create or replace function storage.foldername(name text)
returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts,1)-1];
end
$$;

create or replace function storage.filename(name text)
returns text language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts,1)];
end
$$;

create or replace function storage.extension(name text)
returns text language plpgsql immutable as $$
declare _parts text[]; _filename text;
begin
  select string_to_array(name, '/') into _parts;
  _filename := _parts[array_length(_parts,1)];
  return reverse(split_part(reverse(_filename), '.', 1));
end
$$;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
