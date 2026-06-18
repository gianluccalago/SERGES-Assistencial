-- ============================================================================
-- SERGES — Calendário de Obrigações + Setor Comercial Público
-- Schema, RLS, gates de papel (gestor/equipe), realtime e Storage.
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
-- É idempotente: pode ser reaplicado sem perder dados.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfis e papéis
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  role text not null default 'equipe' check (role in ('gestor','equipe')),
  created_at timestamptz default now()
);

-- Cria o perfil automaticamente no primeiro cadastro (sempre como 'equipe').
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Papel do usuário atual (security definer evita recursão de RLS).
create or replace function public.papel()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabelas de dados (uma linha jsonb por entidade, id estável)
-- ---------------------------------------------------------------------------
create table if not exists public.projects           (id text   primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.holidays           (date text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.overrides          (id text   primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.manual_obligations (id text   primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.contatos           (id text   primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.app_config         (id int    primary key, data jsonb not null);
-- Módulo Setor Comercial Público
create table if not exists public.editais            (id text   primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.contratos          (id text   primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.comercial_config   (id int    primary key, data jsonb not null);

-- ---------------------------------------------------------------------------
-- 3. RLS — exige autenticação em tudo
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.projects           enable row level security;
alter table public.holidays           enable row level security;
alter table public.overrides          enable row level security;
alter table public.manual_obligations enable row level security;
alter table public.contatos           enable row level security;
alter table public.app_config         enable row level security;
alter table public.editais            enable row level security;
alter table public.contratos          enable row level security;
alter table public.comercial_config   enable row level security;

-- Helper para recriar policies de forma idempotente.
-- (Postgres não tem "create policy if not exists"; usamos drop+create.)

-- Profiles: todos autenticados leem; só gestor altera papéis.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.papel() = 'gestor') with check (public.papel() = 'gestor');

-- Tabelas operacionais (equipe e gestor leem e escrevem):
--   overrides, manual_obligations, contatos, app_config, editais, contratos, comercial_config
do $$
declare t text;
begin
  foreach t in array array['overrides','manual_obligations','contatos','app_config','editais','contratos','comercial_config'] loop
    execute format('drop policy if exists %I_rw on public.%I', t, t);
    execute format(
      'create policy %I_rw on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- Tabelas administrativas (projects, holidays): todos leem; só gestor escreve.
do $$
declare t text;
begin
  foreach t in array array['projects','holidays'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated using (public.papel() = ''gestor'') with check (public.papel() = ''gestor'')', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Gates de papel no banco (defesa além da interface)
-- ---------------------------------------------------------------------------
-- Editais: decisão (participar/descartar) e conferência (aprovar/comentar)
-- são exclusivas do gestor.
create or replace function public.gate_editais()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.papel() = 'equipe' then
    if (old.data->>'fase') = 'decisao' and (new.data->>'fase') in ('reunir','descartado') then
      raise exception 'Decisão de edital é ação exclusiva do gestor';
    end if;
    if (old.data->>'fase') = 'conferencia' and (new.data->>'fase') in ('envio','correcao') then
      raise exception 'Conferência documental é ação exclusiva do gestor';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_gate_editais on public.editais;
create trigger trg_gate_editais before update on public.editais
  for each row execute function public.gate_editais();

-- Aprovar o SLA (concluir a partir de "Em aprovação") é exclusivo do gestor.
create or replace function public.gate_aprovacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.papel() = 'equipe'
     and (old.data->>'estado') = 'emAprovacao'
     and (new.data->>'estado') = 'concluida' then
    raise exception 'Aprovação do SLA é ação exclusiva do gestor';
  end if;
  return new;
end; $$;
drop trigger if exists trg_gate_aprov_ov on public.overrides;
create trigger trg_gate_aprov_ov before update on public.overrides
  for each row execute function public.gate_aprovacao();
drop trigger if exists trg_gate_aprov_mo on public.manual_obligations;
create trigger trg_gate_aprov_mo before update on public.manual_obligations
  for each row execute function public.gate_aprovacao();

-- ---------------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['projects','holidays','overrides','manual_obligations','contatos','app_config','editais','contratos','comercial_config'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; -- já está na publicação
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Storage (anexos reais) — bucket privado + acesso autenticado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

drop policy if exists anexos_read   on storage.objects;
drop policy if exists anexos_insert on storage.objects;
drop policy if exists anexos_update on storage.objects;
drop policy if exists anexos_delete on storage.objects;
create policy anexos_read   on storage.objects for select to authenticated using (bucket_id = 'anexos');
create policy anexos_insert on storage.objects for insert to authenticated with check (bucket_id = 'anexos');
create policy anexos_update on storage.objects for update to authenticated using (bucket_id = 'anexos');
create policy anexos_delete on storage.objects for delete to authenticated using (bucket_id = 'anexos');

-- ---------------------------------------------------------------------------
-- 7. Seed de papéis (rode DEPOIS de criar os usuários em Authentication → Users)
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'gestor' where email in ('gian@serges...', 'giuliano@serges...');
-- update public.profiles set role = 'equipe' where email in ('julyane@serges...');
