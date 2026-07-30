-- ============================================================================
-- SERGES — Setores (calendários isolados por área da empresa)
--
-- Cada usuário pertence a um SETOR. Os dados (projetos, séries, obrigações,
-- overrides, contatos, feriados e config) passam a ser carimbados com o setor,
-- e o RLS garante que ninguém enxergue o de outro setor — isolamento de banco,
-- não só de tela.
--
-- Rode este arquivo INTEIRO no SQL Editor, DEPOIS do schema.sql e do
-- admin_usuarios.sql. É idempotente: pode reaplicar sem perder nada.
--
-- Todos os dados existentes viram 'assistencial' (nada muda para a equipe atual).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Coluna de setor no perfil e nas tabelas de dados
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists setor text not null default 'assistencial';

-- Setor do usuário logado. security definer evita recursão de RLS ao ler profiles.
-- Sem sessão, devolve NULL de propósito: `setor = null` nunca é verdadeiro, então
-- as policies não liberam nada — nunca "cai" no assistencial por engano.
create or replace function public.meu_setor()
returns text language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then null
    -- Usuário sem perfil (legado): assistencial, como sempre foi.
    else coalesce((select setor from public.profiles where id = auth.uid()), 'assistencial')
  end;
$$;
grant execute on function public.meu_setor() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['projects','holidays','tarefas_fixas','overrides',
                           'manual_obligations','contatos','app_config'] loop
    -- 1) Cria com default literal: TODO dado que já existe vira 'assistencial'.
    execute format('alter table public.%I add column if not exists setor text not null default ''assistencial''', t);
    -- 2) Daqui em diante, o default é o setor de quem insere — o cliente não
    --    precisa mandar a coluna, e ninguém consegue carimbar setor alheio.
    execute format('alter table public.%I alter column setor set default public.meu_setor()', t);
    execute format('create index if not exists %I on public.%I (setor)', 'idx_' || t || '_setor', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. RLS por setor
--    - Tabelas operacionais: quem é do setor lê e escreve.
--    - Tabelas administrativas (projetos, feriados, séries): todos do setor
--      leem; só o GESTOR DAQUELE SETOR escreve. Mesma regra de antes, agora
--      recortada por setor.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['overrides','manual_obligations','contatos','app_config'] loop
    execute format('drop policy if exists %I_rw on public.%I', t, t);
    execute format(
      'create policy %I_rw on public.%I for all to authenticated
         using (setor = public.meu_setor()) with check (setor = public.meu_setor())', t, t);
  end loop;

  foreach t in array array['projects','holidays','tarefas_fixas'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select to authenticated
         using (setor = public.meu_setor())', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated
         using (setor = public.meu_setor() and public.papel() = ''gestor'')
         with check (setor = public.meu_setor() and public.papel() = ''gestor'')', t, t);
  end loop;
end $$;

-- Perfis: cada um vê os do próprio setor; o gestor do setor edita os seus.
-- (Gestor do assistencial continua vendo todos, para administrar a empresa.)
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (setor = public.meu_setor() or public.meu_setor() = 'assistencial');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.papel() = 'gestor' and (setor = public.meu_setor() or public.meu_setor() = 'assistencial'))
  with check (public.papel() = 'gestor' and (setor = public.meu_setor() or public.meu_setor() = 'assistencial'));

-- ---------------------------------------------------------------------------
-- 3. Criar usuário passa a receber o setor (troca a função de admin_usuarios.sql)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_criar_usuario(text, text, text, text);

create or replace function public.admin_criar_usuario(
  p_email text,
  p_senha text,
  p_nome  text default null,
  p_papel text default 'equipe',
  p_setor text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  novo_id uuid := gen_random_uuid();
  papel   text := case when p_papel = 'gestor' then 'gestor' else 'equipe' end;
  -- Sem setor explícito, cria no setor de quem está criando.
  setor_n text := coalesce(nullif(trim(p_setor), ''), public.meu_setor());
  email_n text := lower(trim(p_email));
  tem_provider_id boolean;
begin
  if public.papel() is distinct from 'gestor' then
    raise exception 'Apenas gestores podem administrar usuários.';
  end if;
  -- Gestor só cria fora do próprio setor se for do assistencial (administra a empresa).
  if setor_n <> public.meu_setor() and public.meu_setor() <> 'assistencial' then
    raise exception 'Você só pode criar usuários do seu próprio setor.';
  end if;
  if email_n is null or email_n = '' then
    raise exception 'E-mail é obrigatório.';
  end if;
  if p_senha is null or length(p_senha) < 6 then
    raise exception 'A senha precisa ter ao menos 6 caracteres.';
  end if;
  if exists (select 1 from auth.users where lower(email) = email_n) then
    raise exception 'Já existe um usuário com este e-mail.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', novo_id, 'authenticated', 'authenticated',
    email_n, extensions.crypt(p_senha, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', coalesce(nullif(trim(p_nome), ''), email_n)),
    '', '', '', ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into tem_provider_id;

  if tem_provider_id then
    execute $i$
      insert into auth.identities (id, user_id, identity_data, provider, provider_id,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), $1, $2, 'email', $3, now(), now(), now())
    $i$ using novo_id, jsonb_build_object('sub', novo_id::text, 'email', email_n), novo_id::text;
  else
    execute $i$
      insert into auth.identities (id, user_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), $1, $2, 'email', now(), now(), now())
    $i$ using novo_id, jsonb_build_object('sub', novo_id::text, 'email', email_n);
  end if;

  insert into public.profiles (id, email, nome, role, setor)
  values (novo_id, email_n, coalesce(nullif(trim(p_nome), ''), email_n), papel, setor_n)
  on conflict (id) do update
    set email = excluded.email, nome = excluded.nome, role = excluded.role, setor = excluded.setor;

  return novo_id;
end;
$$;

revoke all on function public.admin_criar_usuario(text, text, text, text, text) from public, anon;
grant execute on function public.admin_criar_usuario(text, text, text, text, text) to authenticated;

-- Perfis criados pelo trigger de signup nascem no assistencial (default da coluna).

-- ---------------------------------------------------------------------------
-- 4. Coloca o Vinícius no Financeiro, como gestor DO SETOR DELE.
--    Gestor aqui significa: pode criar as próprias séries, projetos e o login
--    do estagiário — tudo dentro do Financeiro. Não enxerga o assistencial.
-- ---------------------------------------------------------------------------
update public.profiles
   set setor = 'financeiro', role = 'gestor'
 where lower(email) = 'vinicius.veiga@serges.org';

-- ---------------------------------------------------------------------------
-- 5. Verificação
-- ---------------------------------------------------------------------------
select email, nome, role as papel, setor from public.profiles order by setor, email;

-- Quantas linhas cada setor enxerga (deve ficar tudo em 'assistencial',
-- e o financeiro começa zerado):
select 'projects' as tabela, setor, count(*) from public.projects group by setor
union all select 'tarefas_fixas', setor, count(*) from public.tarefas_fixas group by setor
union all select 'manual_obligations', setor, count(*) from public.manual_obligations group by setor
union all select 'overrides', setor, count(*) from public.overrides group by setor
union all select 'contatos', setor, count(*) from public.contatos group by setor
order by 1, 2;
