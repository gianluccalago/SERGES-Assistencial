# Setup do Supabase — SERGES

Passo a passo para conectar o app ao seu projeto Supabase. Faça **nesta ordem**.

## 1. Schema e persistência

1. No painel do Supabase, abra **SQL Editor**.
2. Cole todo o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.
   - Cria as tabelas (jsonb por entidade), RLS, gates de papel, realtime e o bucket de Storage `anexos`.
   - É idempotente: pode rodar de novo sem perder dados.

## 2. Variáveis de ambiente

Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

- **Local:** crie um arquivo `.env` na raiz (use `.env.example` como base):
  ```
  VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
  VITE_SUPABASE_ANON_KEY=sua-anon-key
  ```
- **Render:** em **Environment** do Static Site, adicione as duas variáveis com os mesmos valores e faça um novo deploy.

> A anon key é pública por design. A segurança real vem do RLS (item 1) — todo acesso exige login.

## 3. Migração dos dados antigos (localStorage → Supabase)

A migração é **automática e sem perda**:

- No **primeiro login** após configurar as env vars, se o banco estiver vazio e houver dados no `localStorage` do navegador, o app importa tudo para o Supabase e marca como migrado (`serges.migrado.supabase`).
- O `localStorage` **não é apagado** — fica como backup.
- ⚠️ Faça o primeiro acesso **no mesmo navegador/computador** onde os dados já estavam preenchidos, para que sejam encontrados e migrados. Depois disso, os dados passam a vir do Supabase em qualquer lugar.
- ⚠️ **Importante:** como `projects` e `feriados` só podem ser gravados por **gestor**, faça esse primeiro acesso **logado como um gestor** (item 4 antes deste). Caso contrário, a importação de projetos/feriados será barrada pelo RLS.

## 4. Autenticação e usuários

1. Em **Authentication → Providers**, mantenha **Email** habilitado e **desligue** "Enable sign-ups" (sem cadastro público) — opcional, mas recomendado.
2. Em **Authentication → Users → Add user**, crie cada pessoa com e-mail e senha:
   - Gian, Giuliano, Julyane (e demais).
3. No primeiro login, cada um ganha um perfil como **equipe** automaticamente.
4. Defina os gestores. No **SQL Editor**:
   ```sql
   update public.profiles set role = 'gestor'
     where email in ('gian@exemplo.com', 'giuliano@exemplo.com');
   ```
   Ou pela tela **Usuários** dentro do app (logado como gestor).

### Papéis

- **Gestor** (CEO/Gian/Giuliano): faz tudo, incluindo as ações exclusivas — decidir participar/descartar editais, aprovar/comentar na conferência documental, aprovar o SLA de 24h, e administrar projetos, feriados e usuários.
- **Equipe** (faturista/Julyane): toda a operação. Vê as ações de gestor desabilitadas, com o motivo "Ação exclusiva do gestor". As mutações sensíveis também são barradas **no banco** (triggers do `schema.sql`), não só na interface.

### Administração de usuários (criar/excluir pela tela "Usuários")

**Recomendado — rode [`admin_usuarios.sql`](./admin_usuarios.sql) no SQL Editor (uma vez).**
Ele cria duas funções no próprio Postgres (`admin_criar_usuario` e
`admin_excluir_usuario`) que rodam com privilégio elevado mas **só aceitam
chamadas de gestor**. Com isso a tela **Usuários** funciona por completo —
criar, renomear, mudar papel e excluir — **sem publicar nenhuma Edge Function**.

> Renomear e mudar papel nem passam por essas funções: gravam direto em
> `public.profiles`, onde o RLS já permite ao gestor escrever.

**Alternativa — Edge Function** (`supabase/functions/admin-users`), caso prefira
usar a Admin API em vez das funções SQL. O app tenta as funções do banco
primeiro e cai nesta automaticamente se elas não existirem.

- Pelo painel: **Edge Functions → Create a function**, nome **`admin-users`**,
  cole [`functions/admin-users/index.ts`](./functions/admin-users/index.ts) e **Deploy**.
- Pela CLI: `supabase functions deploy admin-users`

> Não precisa configurar segredos: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das Edge Functions. A função verifica que o chamador é **gestor** antes de qualquer ação.

## 5. Verificação

- [ ] Logado como gestor: dados antigos aparecem intactos (calendário, contatos, projetos, editais, contratos).
- [ ] Dois navegadores logados: uma alteração aparece no outro sem refresh (realtime).
- [ ] Logado como equipe: botões de decisão/conferência e a aprovação do SLA aparecem **desabilitados**.
- [ ] Logado como equipe, tentando forçar uma dessas mutações: o banco **rejeita** (o app recarrega e reverte).
- [ ] Upload de um PDF num edital: abre e baixa por URL assinada; remover funciona.
- [ ] Tela **Usuários** (gestor): criar, renomear, mudar papel e excluir funcionam (requer a Edge Function `admin-users` publicada).
