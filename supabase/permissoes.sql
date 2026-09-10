-- ===========================================================================
-- SERGES — permissão granular de CATÁLOGO (projetos, séries e feriados)
-- ===========================================================================
-- Problema: até aqui, só o gestor podia criar/editar projetos, séries mensais
-- e feriados. Para liberar a Julyane sem promovê-la a gestor (o que também lhe
-- daria Comercial Público, Apresentação de Resultados, administração de
-- usuários e a aprovação do SLA de 24h), criamos uma permissão à parte.
--
-- pode_catalogo = true  →  cria/edita/exclui projetos, séries e feriados
--                          DENTRO DO PRÓPRIO SETOR. Nada além disso.
--
-- Compromissos (manual_obligations), ajustes do calendário (overrides),
-- contatos e demandas JÁ eram liberados para toda a equipe do setor — este
-- arquivo não mexe neles.
--
-- Idempotente: pode rodar quantas vezes quiser.
-- Pré-requisito: setores.sql já rodado.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. A coluna de permissão
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists pode_catalogo boolean not null default false;

comment on column public.profiles.pode_catalogo is
  'Permite criar/editar projetos, séries mensais e feriados do próprio setor, sem ser gestor.';

-- ---------------------------------------------------------------------------
-- 2. A função de checagem
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: a policy roda como o usuário logado, que não tem GRANT de
-- leitura em auth/profiles por dentro do RLS. Sem isto, a policy quebra com
-- "permission denied". Mesmo padrão de papel() e meu_setor().
create or replace function public.pode_catalogo()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select p.role = 'gestor' or p.pode_catalogo
       from public.profiles p
      where p.id = auth.uid()),
    false)
$$;

revoke all on function public.pode_catalogo() from public;
grant execute on function public.pode_catalogo() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. As policies de escrita do catálogo passam a aceitar pode_catalogo()
-- ---------------------------------------------------------------------------
-- A leitura continua igual (todo mundo do setor lê). Só a escrita muda:
-- antes exigia papel() = 'gestor'; agora aceita gestor OU pode_catalogo.
do $$
declare t text;
begin
  foreach t in array array['projects','holidays','tarefas_fixas'] loop
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated
         using (setor = public.meu_setor() and public.pode_catalogo())
         with check (setor = public.meu_setor() and public.pode_catalogo())', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Libera a Julyane
-- ---------------------------------------------------------------------------
-- Casa pelo e-mail OU pelo nome, sem depender de saber o endereço exato.
update public.profiles
   set pode_catalogo = true
 where lower(coalesce(email, '')) like '%julyane%'
    or lower(coalesce(nome, ''))  like '%julyane%';

-- ---------------------------------------------------------------------------
-- 5. Verificação — leia o resultado
-- ---------------------------------------------------------------------------
select
  case
    when count(*) = 0
      then 'FALHA: nenhum perfil com "julyane" no e-mail ou no nome. '
        || 'Confira a grafia na tela Usuários e rode: '
        || 'update public.profiles set pode_catalogo = true where email = ''<e-mail dela>'';'
    else 'OK — ' || string_agg(coalesce(nome, email) || ' (' || setor || ')', ', ')
        || ' agora pode criar/editar projetos, séries e feriados do setor.'
  end as resultado
from public.profiles
where pode_catalogo and not (role = 'gestor');

-- Panorama de quem tem a permissão hoje:
select email, nome, role, setor, pode_catalogo
  from public.profiles
 order by pode_catalogo desc, email;
