-- ============================================================================
-- SERGES — Administração de usuários SEM Edge Function.
-- Cria duas funções (criar/excluir usuário) que rodam no próprio Postgres com
-- privilégio elevado, mas SÓ aceitam chamadas de quem é 'gestor'. Com isso a
-- tela "Usuários" funciona sem publicar nada em Edge Functions.
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase. É idempotente.
-- No fim, ele já cria o usuário do Vinícius (veja a seção 3).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Criar usuário  →  public.admin_criar_usuario(email, senha, nome, papel)
-- ---------------------------------------------------------------------------
create or replace function public.admin_criar_usuario(
  p_email text,
  p_senha text,
  p_nome  text default null,
  p_papel text default 'equipe'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  novo_id uuid := gen_random_uuid();
  papel   text := case when p_papel = 'gestor' then 'gestor' else 'equipe' end;
  email_n text := lower(trim(p_email));
  tem_provider_id boolean;
begin
  -- Só gestor administra usuários (mesma regra da Edge Function).
  if public.papel() is distinct from 'gestor' then
    raise exception 'Apenas gestores podem administrar usuários.';
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

  -- Campos de token vão como '' (string vazia) e NÃO nulos: com NULL, o login
  -- do GoTrue quebra com "converting NULL to string is unsupported".
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

  -- A identidade de e-mail é exigida para o login por senha nas versões atuais.
  -- provider_id existe só nas mais novas: detecta antes de inserir.
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

  -- Perfil da aplicação (o trigger on_auth_user_created já pode ter criado).
  insert into public.profiles (id, email, nome, role)
  values (novo_id, email_n, coalesce(nullif(trim(p_nome), ''), email_n), papel)
  on conflict (id) do update
    set email = excluded.email, nome = excluded.nome, role = excluded.role;

  return novo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Excluir usuário  →  public.admin_excluir_usuario(id)
-- ---------------------------------------------------------------------------
create or replace function public.admin_excluir_usuario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.papel() is distinct from 'gestor' then
    raise exception 'Apenas gestores podem administrar usuários.';
  end if;
  if p_id = auth.uid() then
    raise exception 'Você não pode excluir o próprio usuário.';
  end if;
  -- profiles tem FK on delete cascade para auth.users.
  delete from auth.users where id = p_id;
end;
$$;

-- Só usuários autenticados podem sequer chamar (a checagem de gestor é interna).
revoke all on function public.admin_criar_usuario(text, text, text, text) from public, anon;
revoke all on function public.admin_excluir_usuario(uuid) from public, anon;
grant execute on function public.admin_criar_usuario(text, text, text, text) to authenticated;
grant execute on function public.admin_excluir_usuario(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cria o usuário do Vinícius agora (idempotente: se já existir, só ajusta).
--    Aqui rodamos como dono do banco, então pulamos a checagem de gestor
--    inserindo direto — é o mesmo efeito da função acima.
-- ---------------------------------------------------------------------------
do $seed$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := 'vinicius.veiga@serges.org';
  v_senha text := 'coxalider';
  v_nome  text := 'Vinícius';
  v_papel text := 'equipe';   -- troque para 'gestor' se ele precisar ver tudo
  tem_provider_id boolean;
  existente uuid;
begin
  select id into existente from auth.users where lower(email) = v_email;

  if existente is not null then
    -- Já existe: apenas garante a senha, a confirmação do e-mail e o papel.
    update auth.users
       set encrypted_password = extensions.crypt(v_senha, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = existente;
    insert into public.profiles (id, email, nome, role)
    values (existente, v_email, v_nome, v_papel)
    on conflict (id) do update set email = excluded.email, nome = excluded.nome, role = excluded.role;
    raise notice 'Usuário já existia — senha e papel atualizados (%).', v_email;
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_senha, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', v_nome),
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
      $i$ using v_id, jsonb_build_object('sub', v_id::text, 'email', v_email), v_id::text;
    else
      execute $i$
        insert into auth.identities (id, user_id, identity_data, provider,
                                     last_sign_in_at, created_at, updated_at)
        values (gen_random_uuid(), $1, $2, 'email', now(), now(), now())
      $i$ using v_id, jsonb_build_object('sub', v_id::text, 'email', v_email);
    end if;

    insert into public.profiles (id, email, nome, role)
    values (v_id, v_email, v_nome, v_papel)
    on conflict (id) do update set email = excluded.email, nome = excluded.nome, role = excluded.role;
    raise notice 'Usuário criado: % (papel %).', v_email, v_papel;
  end if;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 4. VERIFICAÇÃO — confere as pré-condições reais do login do Vinícius.
--    Se a última coluna disser "LOGIN OK", pode entrar no app com a senha.
-- ---------------------------------------------------------------------------
select
  u.email,
  p.role                                                        as papel,
  (u.encrypted_password = extensions.crypt('coxalider', u.encrypted_password))
                                                                as senha_confere,
  (u.email_confirmed_at is not null)                            as email_confirmado,
  (i.id is not null)                                            as identidade_ok,
  (u.confirmation_token is not null and u.recovery_token is not null
   and u.email_change_token_new is not null and u.email_change is not null)
                                                                as tokens_ok,
  case
    when u.encrypted_password is distinct from extensions.crypt('coxalider', u.encrypted_password)
      then 'FALHA: senha não confere'
    when u.email_confirmed_at is null then 'FALHA: e-mail não confirmado'
    when i.id is null then 'FALHA: falta a identidade de e-mail'
    when u.confirmation_token is null or u.recovery_token is null
      or u.email_change_token_new is null or u.email_change is null
      then 'FALHA: tokens nulos quebram o login do GoTrue'
    when p.id is null then 'FALHA: perfil não criado em public.profiles'
    else 'LOGIN OK'
  end                                                           as veredito
from auth.users u
left join public.profiles p on p.id = u.id
left join auth.identities i on i.user_id = u.id and i.provider = 'email'
where lower(u.email) = 'vinicius.veiga@serges.org';

-- Panorama de todos os usuários:
select p.email, p.nome, p.role, (u.email_confirmed_at is not null) as email_confirmado
from public.profiles p join auth.users u on u.id = p.id
order by p.email;
