-- ============================================================================
-- SERGES — Demandas + visibilidade restrita
--
-- 1) Tabela `demandas`: trabalho repassado, em andamento, SEM data fixa — só um
--    período (de … até) com prazo máximo de entrega.
-- 2) Visibilidade por registro: 'setor' (padrão, todo mundo do setor) ou
--    'restrita' (só quem criou, quem foi autorizado e o gestor do setor).
--    A regra vale AQUI, no banco: quem não pode ver não recebe a linha.
--    Vale para `demandas` e para as obrigações criadas à mão.
--
-- Rode INTEIRO no SQL Editor, DEPOIS de setores.sql. Idempotente.
-- ============================================================================

create table if not exists public.demandas (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table public.demandas enable row level security;
-- O Supabase concede isso por padrão em novas tabelas do schema public, mas
-- deixamos explícito para o script não depender da configuração do projeto.
grant select, insert, update, delete on public.demandas to authenticated;

-- Mesma coluna de setor das demais tabelas (ver setores.sql).
alter table public.demandas add column if not exists setor text not null default 'assistencial';
alter table public.demandas alter column setor set default public.meu_setor();
create index if not exists idx_demandas_setor on public.demandas (setor);

-- ---------------------------------------------------------------------------
-- Regra de visibilidade, usada nas policies.
--   - sem marcação ou 'setor'  → todo mundo do setor vê;
--   - 'restrita'               → só o criador, os autorizados e o gestor.
-- `d` é o jsonb do registro.
-- ---------------------------------------------------------------------------
-- security definer como papel()/meu_setor(): a função lê auth.uid() e não pode
-- depender de o papel `authenticated` ter acesso ao schema auth.
create or replace function public.pode_ver(d jsonb)
returns boolean language sql stable security definer
set search_path = public, auth as $$
  select
    coalesce(d->>'visibilidade', 'setor') <> 'restrita'
    or public.papel() = 'gestor'
    or d->>'criadoPor' = auth.uid()::text
    or coalesce(d->'permitidos', '[]'::jsonb) ? auth.uid()::text;
$$;
grant execute on function public.pode_ver(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies: setor + visibilidade.
-- Quem escreve precisa continuar enxergando o próprio registro (with check),
-- senão a linha "sumiria" logo após ser gravada.
-- ---------------------------------------------------------------------------
drop policy if exists demandas_rw on public.demandas;
create policy demandas_rw on public.demandas for all to authenticated
  using (setor = public.meu_setor() and public.pode_ver(data))
  with check (setor = public.meu_setor() and public.pode_ver(data));

-- Obrigações criadas à mão passam a respeitar a mesma regra. As geradas
-- (projetos e séries) seguem visíveis a todo o setor: são a rotina da área,
-- não tarefa pessoal.
drop policy if exists manual_obligations_rw on public.manual_obligations;
create policy manual_obligations_rw on public.manual_obligations for all to authenticated
  using (setor = public.meu_setor() and public.pode_ver(data))
  with check (setor = public.meu_setor() and public.pode_ver(data));

-- Realtime, como nas demais tabelas. Nunca derruba o script: se a publicação
-- não existir ou a tabela já estiver nela, apenas segue.
do $$
begin
  alter publication supabase_realtime add table public.demandas;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
select 'demandas' as tabela, setor, count(*) from public.demandas group by setor;
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('demandas', 'manual_obligations')
order by tablename, policyname;
