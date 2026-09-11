# Serges Hub — Módulo **Calendário Operacional**

> Prompt de construção para o Lovable. Este documento descreve um módulo novo do Serges Hub, nascido de um app que já roda em produção na BU Assistencial e fez sucesso na empresa. A meta é trazer as mesmas funcionalidades para dentro do Hub, generalizadas para qualquer equipe.
>
> **Como ler este documento:** as seções "Regras" são o que o app faz hoje e as pessoas dependem — respeite. As seções "Sugestão" são o caminho que funcionou, mas você conhece o Hub melhor do que este texto: adapte modelo de dados, componentes e navegação ao que já existe. Onde houver conflito entre este documento e um padrão consolidado do Hub, siga o padrão do Hub e diga o que mudou.

---

## 0. Em uma frase

Um calendário de obrigações e compromissos **por equipe**, com séries mensais, tarefas recorrentes, checklist de etapas, demandas sem data fixa, visibilidade restrita por item, aprovação de gestor opcional e isolamento total entre equipes — dentro do Serges Hub, sem login próprio, com a identidade visual do Hub.

---

## 1. Onde o módulo entra no Hub

- **Home do Hub:** um quarto card ao lado de *Operacional*, *Financeiro* e *Notebooks*, no mesmo estilo (ícone colorido, título, descrição curta, seta).
  - Título: **Calendário Operacional**
  - Descrição: *Obrigações, prazos e rotinas de cada equipe — o que fazer hoje, esta semana e este mês.*
  - Ícone: calendário. Escolha uma cor de ícone que ainda não esteja em uso pelos outros cards.
- **Autenticação:** nenhuma. O usuário já está logado no Hub. Use a sessão, o usuário e o cadastro de pessoas do Hub. Não crie tela de login, cadastro de usuários nem recuperação de senha.
- **Identidade visual:** é apenas mais um módulo do Hub. Use o design system, tokens, tipografia, componentes e padrões de navegação já existentes. Não invente uma paleta própria. A única disciplina de cor que o módulo pede está na seção 8.
- **Navegação interna (sugestão):** sidebar do módulo com: Calendário · Demandas · Séries · Projetos · Feriados · Equipe · e, no rodapé, o link externo do Oráculo (ver 2.5). O Hub pode ter um padrão diferente de navegação de módulo — siga o do Hub.

---

## 2. Conceitos centrais

### 2.1 Espaço de calendário (a "equipe")

O módulo é multi-equipe. Cada **espaço** é um calendário completo e isolado: tem suas próprias séries, compromissos, demandas, feriados extras, contatos, membros e configurações. Uma pessoa **não enxerga nada** de um espaço do qual não é membro — e isso é garantido no banco (RLS), não só na tela.

- Espaços são criados por um **administrador do Hub**. Exemplos: "Assistencial – Faturamento", "Financeiro", "RH", "Comercial".
- Uma pessoa pode ser membro de **um ou mais** espaços. Se for de vários, há um seletor de espaço (no topo do módulo ou na sidebar); o último escolhido fica lembrado.
- Se a pessoa não é membro de nenhum espaço, o módulo mostra uma tela vazia explicando isso e quem pode incluí-la.

### 2.2 Papéis dentro do espaço

Dois papéis, por espaço (a mesma pessoa pode ser gestora num espaço e equipe em outro):

| Papel | O que faz |
|---|---|
| **Gestor** | Tudo. Além do que a equipe faz: aprova itens em "Em aprovação do Gestor" (se o espaço usa aprovação), edita séries/projetos/feriados/configurações do espaço, gerencia membros do espaço, concede a permissão de catálogo, enxerga itens com visibilidade restrita. |
| **Equipe** | Toda a operação do dia a dia: cria/edita/exclui compromissos e demandas, muda status, marca etapas, move datas, oculta/restaura itens gerados, registra cobrança/escalonamento. **Não** aprova SLA, não edita séries/projetos (salvo permissão de catálogo), não gerencia membros. |

**Permissão de catálogo** (`pode_catalogo`): um flag por membro que o gestor liga/desliga. Quem tem, edita séries, feriados e a configuração de calendário dos projetos **sem** ser gestor. Existe para não precisar promover alguém a gestor só para cadastrar uma série.

Administrador do Hub cria/edita/exclui espaços e define o(s) primeiro(s) gestor(es). Adapte ao modelo de papéis que o Hub já tem — o que importa é que as três capacidades (isolar espaços, aprovar, delegar catálogo) existam.

### 2.3 Projetos (vêm do Hub)

Projetos **não são cadastrados no módulo** — já existem no Hub (módulo Operacional). O calendário apenas os referencia:

- Cada espaço escolhe **quais projetos do Hub** aparecem no seu calendário (multi-seleção na configuração do espaço; padrão: nenhum ou todos, você decide o que faz mais sentido no Hub).
- Compromissos, séries e demandas podem apontar para um projeto (opcional). O filtro por projeto e o agrupamento do Checklist usam isso.
- **Contatos ficam dentro do projeto:** uma aba "Contatos" na página do projeto (ou um painel lateral, conforme o padrão do Hub), com: nome, papel/cargo, categoria (`contratante` · `interno` · `contabilidade` — extensível), telefone, e-mail, notas, e o flag **escalonamento** (contato a acionar quando o primário não responde). Um contato pode estar ligado a mais de um projeto. Se o Hub já tem contatos de projeto, reaproveite e apenas acrescente categoria e escalonamento.
- Se o Hub ainda não tem o conceito de "projeto inativo", trate normalmente; se tem, projetos inativos saem dos seletores mas não somem do histórico.

### 2.4 Feriados e dia útil

- **Feriados nacionais brasileiros** são automáticos para qualquer ano (fixos + móveis derivados da Páscoa: Carnaval seg/ter, Sexta-feira Santa, Corpus Christi). Não precisam ser cadastrados.
- Cada espaço pode acrescentar **feriados próprios** (municipais, pontos facultativos, recesso da empresa): data + nome. Um feriado próprio pode ser marcado como "todo ano".
- **Dia útil** = não é sábado, não é domingo, não é feriado (nacional ou do espaço).
- **Regra de dia útil** de uma data (aparece em séries e recorrências):
  - `antecipa` → se cair em dia não útil, recua para o dia útil anterior. Uso: prazos críticos internos, tetos ("até dia 20").
  - `adia` → se cair em dia não útil, avança para o próximo dia útil. Uso: pagamentos, datas genéricas.
  - `nenhum` → fica na data, mesmo em fim de semana/feriado.

### 2.5 Oráculo

Cada espaço pode configurar um **link externo** chamado Oráculo (base de conhecimento da equipe — hoje é um NotebookLM). Aparece na sidebar do módulo como link que abre em nova aba, com o rótulo configurável.

- No espaço do Assistencial, deixe pré-configurado:
  - Rótulo: **Oráculo da BU Assistencial**
  - URL: `https://notebooklm.google.com/notebook/ee50a784-7239-4b3a-a7d3-a4fb591616c1`
- Nos demais espaços, o link fica oculto até o gestor configurar um.

---

## 3. Regras de negócio (o que as pessoas dependem)

### 3.1 Os quatro status — exatamente estes, com estes nomes

| Chave | Rótulo na tela |
|---|---|
| `pendente` | **Pendente** |
| `aguardandoInput` | **Aguardando input do contratante** |
| `emAprovacao` | **Em aprovação do Gestor** |
| `concluida` | **Concluído** |

Não crie outros status. "Atrasada", "Crítico" e "Contratante atrasado" **não são status**: são **selos derivados** que coexistem com o status (3.2). "Cobrar" e "Escalar" são **ações**, não status.

Transições: livres entre os quatro, com duas exceções:
1. Se o espaço usa aprovação (3.9): `emAprovacao → concluida` **só por gestor**. Para a equipe, a opção aparece desabilitada com o sufixo "(gestor)". Garanta também no banco (trigger/policy), não só na tela.
2. Concluir um item em `aguardandoInput` é bloqueado com a explicação *"Aguarda o contratante: registre o retorno em vez de concluir."* — a ação certa é "Registrar retorno", que volta o item para `pendente` (com nova data opcional). Nunca um botão apagado sem motivo: sempre mostre o porquê.

### 3.2 Selos derivados (calculados na hora, nunca gravados)

- **Atrasada**: tem prazo, hoje > prazo, e o status não é `concluida` nem `aguardandoInput`, e o item não está marcado como "sem atuação neste mês". (Atraso "por culpa nossa".)
- **Contratante atrasado**: hoje > prazo e status `aguardandoInput`. Não é culpa nossa, mas sinaliza reforçar a cobrança.
- **Crítico**: flag do item (vem da série, da recorrência ou marcado à mão). Só muda a ênfase visual; não altera regra nenhuma.
- **Aprovação estourada**: enviado para aprovação há mais tempo que o SLA do espaço (3.9). Mostra "há Xh", não muda o status.

### 3.3 Séries (compromissos mensais)

A rotina que se repete todo mês na mesma data-âncora. É a espinha do calendário de qualquer equipe.

- Campos: título · **dia-âncora** (1–31; em mês mais curto, usa o último dia) · **regra de dia útil** (antecipa/adia/nenhum) · crítico (sim/não) · responsável padrão (texto ou membro) · projeto (opcional) · notas.
- Campos opcionais (existem para cobrir rotinas que dependem de terceiro): **sem prazo** (a ocorrência do mês existe, mas não tem data — aparece no bloco *Aguardando o contratante* e no grupo "sem prazo" do Checklist, nunca numa célula de dia) · **estado inicial** (`pendente` por padrão; `aguardandoInput` para "nasce esperando retorno") · **dependência aguardada** (texto curto: "Empenho", "Ordem de compra", "Validação do contratante", "Relatório do contratante", "Retorno do escalista"). Ao "Registrar retorno" (3.8) numa dessas ocorrências, ela vira `pendente` com a data informada.
- As ocorrências mensais são **calculadas**, não gravadas. Mudar o dia-âncora ou a regra recalcula todos os meses, passado e futuro.
- Cada ocorrência (série × mês) pode receber **ajustes** (3.5): status, notas, etapas, data nova, ocultar, responsável do mês. Os ajustes ficam presos ao mês; não vazam para os outros.
- Excluir uma série remove as ocorrências futuras; o que já tinha ajuste em meses passados permanece visível como histórico (você decide a melhor forma — o importante é não apagar histórico marcado).

### 3.4 Compromissos manuais e recorrência

Um compromisso criado à mão para uma data específica. Campos: título · data · tipo (`evento` por padrão; lista extensível) · projeto (opcional) · responsável · notas · crítico · anexo presente (sim/não — apenas um flag, sem upload) · etapas (3.6) · visibilidade (3.7) · **repetir**.

**Repetir** (recorrência):
- `nao` (padrão, data única) · `diaria` · `semanal` · `mensal` · `anual`.
- **A cada N** (intervalo; 1 = toda vez).
- Semanal: **dias da semana** (multi). Vazio = o dia da semana da data-base.
- **Caindo em fim de semana ou feriado:** antecipa / adia / mantém.
- **Repetir até** (opcional; vazio = para sempre).
- As ocorrências são **calculadas na hora** para o período visível, nunca gravadas uma a uma. Mudar a regra reescreve todo o futuro. Cada ocorrência tem seu próprio status/etapas/notas via ajuste (3.5), identificado por `id-do-compromisso@AAAA-MM-DD`.
- Ações numa ocorrência: **Editar esta data** (ajuste local), **Editar a repetição** (abre a regra), **Remover esta data** (só aquele dia sai; a série continua), e na regra **Excluir** (apaga tudo).
- Atalhos de criação: o formulário pode oferecer "presets" por espaço (título + notas + crítico pré-preenchidos) — configuráveis pelo gestor. Não obrigatório.

### 3.5 Ajustes (overrides) — como o gerado é editado sem quebrar a regra

Tudo que é **gerado** (ocorrência de série ou de recorrência) nunca é editado "no lugar": grava-se um **ajuste** por id estável de ocorrência com só o que mudou:
`estado`, `dataNova` (move sem apagar a regra), `dismissed` (ocultar), `titulo`, `responsavel`, `projetoId`, `notas`, `anexoPresente`, `subtarefas`, `enviadaAprovacaoEm`, `retornoRecebidoEm`, `escaladoEm`, `cobrancas[]`, `resolucaoMes` (`semAtuacao` | `parcial`), `markedAt`/`markedBy`.

Consequências que o usuário sente:
- **Ocultar** uma ocorrência gerada a tira do mês; uma faixa discreta "N obrigação(ões) oculta(s)" permite **Restaurar**.
- **Mover para outra data**: a ocorrência aparece na data nova com um marcador "movida"; a regra continua intacta para os outros meses.
- Um item movido pode sair de um mês e entrar em outro: ao montar um mês, considere ajustes de meses vizinhos.

### 3.6 Etapas (checklist de subtarefas)

Em qualquer compromisso, ocorrência ou demanda:
- Lista ordenada de etapas `{ id estável, título, feita }`. Adicionar, renomear inline, reordenar, remover, marcar/desmarcar.
- Barra de progresso "N de M etapas"; o mesmo texto aparece na linha do item nas listas.
- **Etapa concluída continua visível e editável** (pode desmarcar). Existe um toggle "ocultar concluídas" que só recolhe, com uma faixa "N concluída(s) oculta(s) — mostrar". Nunca sumir com uma etapa ao marcar.
- Marcar etapas **não** muda o status do item automaticamente.
- Checkboxes precisam ser visíveis e clicáveis no tema do Hub (cuidado com `color-scheme` em tema escuro).

### 3.7 Visibilidade restrita por item

Compromissos e demandas têm `visibilidade`:
- `espaco` (padrão): todos os membros do espaço veem.
- `restrita`: só **quem criou**, as pessoas na lista `permitidos[]` e os **gestores do espaço**.

Aplicado no banco (RLS): quem não pode ver não recebe a linha. Na tela, um seletor "Quem pode ver" com a lista de membros do espaço. Ocorrências de uma recorrência restrita herdam a restrição.

### 3.8 Ações operacionais

No painel de detalhe de um item:
- **Status** (seletor com os quatro).
- **Editar** (campos), **Mover para outra data**, **Ocultar / Remover esta data / Excluir** (conforme o item é gerado, ocorrência de recorrência ou manual).
- **Cobrar**: registra data/hora de uma cobrança ao contratante (contador "cobrado N×"). Não muda o status.
- **Escalar**: registra que o protocolo de escalonamento foi acionado (data/hora), sugerindo o contato de escalonamento do projeto. Não muda o status.
- **Registrar retorno**: sai de `aguardandoInput` para `pendente`, com nova data opcional.
- **Sem atuação neste mês**: marca a ocorrência como resolvida sem trabalho (não conta como atrasada nem como pendente).
- **Desfazer**: toda ação destrutiva (excluir, ocultar, marcar em lote) mostra um toast com "Desfazer".
- Trilha: `markedAt`/`markedBy` em toda mudança de status (quem e quando). Mostre no detalhe.

### 3.9 Aprovação de gestor — opcional por espaço

Configuração do espaço: **"Usa etapa de aprovação do gestor"** (liga/desliga) e **SLA em horas** (padrão 24).
- Ligado: o status `emAprovacao` existe; a equipe move para lá (grava `enviadaAprovacaoEm`); só gestor conclui a partir dele; passado o SLA, o item mostra "aprovação há Xh" com ênfase.
- Desligado: o status `emAprovacao` não aparece nos seletores desse espaço (mas continue aceitando o valor no dado, para migração e para ligar depois sem perder nada).

O espaço do Assistencial nasce **ligado, 24h**.

### 3.10 Demandas — trabalho com período, sem data fixa

Uma seção própria (não vai no calendário de datas). Serve para trabalho repassado que está em andamento e só tem um **prazo máximo**.

- Campos: título · descrição · responsável · **início** · **prazo máximo** · status (os mesmos quatro) · projeto (opcional) · etapas (3.6) · visibilidade (3.7) · `criadoPor` · `criadoEm` · `concluidaEm` · `arquivada`.
- Situação derivada: `atrasada` (não concluída e hoje > prazo), `diasRestantes` (negativo = dias de atraso), `futura` (hoje < início).
- Lista: **Abertas** (ordenadas por prazo, com "faltam N dias" / "atrasada há N dias"), **Entregues** (recolhível, com botão **Arquivar**), **Arquivadas** (recolhível, com **Restaurar**). Arquivar nunca apaga.
- Opcional: mostrar demandas com prazo no mês como uma faixa fina no topo da visão Mês (sem virar item de dia).

---

## 4. Telas do calendário

Todas as visões compartilham: cabeçalho com **seletor de espaço** (se a pessoa tem mais de um), navegação de período (← Hoje →), **filtros** por projeto e por responsável (a lista de responsáveis vem dos itens do período + membros do espaço, nunca fica vazia num espaço sem projetos), o botão **+ Nova obrigação**, e os **contadores** do mês: *atrasadas* (com ênfase quando > 0) · *aguardando* · *vencendo* (próximos 7 dias) · *concluídas / total*.

Abas: **Dia · Semana · Mês · Lista · Checklist**.

- **Dia**: a superfície de triagem. Grupos: *Atrasadas* → *Hoje* → *Próximos dias* (opcional) → bloco separado *Aguardando o contratante*. Cada linha: título, projeto, responsável, selos, progresso de etapas, status inline. Clique abre o painel de detalhe.
- **Semana**: 7 colunas, itens compactos, **arrastar e soltar** para mover de dia (gera ajuste `dataNova`), com realce do alvo.
- **Mês**: grade como calendário de verdade (células contínuas, não 35 cartões soltos), 2–3 itens por célula + "+N", arrastar e soltar, dias não úteis levemente diferenciados, feriado com nome no rodapé da célula. Faixa "N ocultas" com Restaurar quando houver.
- **Lista**: tabela do mês com filtro por status (pílulas: Todos · Pendente · Aguardando input · Em aprovação · Concluído), ordenável por prazo/projeto/responsável, selos visíveis.
- **Checklist**: o mês agrupado **por semana**, pendentes por padrão, concluídas recolhidas e expansíveis; progresso geral e por projeto; **marcação em lote**: seleciona vários, informa quem está marcando e clica "Marcar concluídas" (registra `markedBy`). Respeita o bloqueio de aprovação (3.1).
- **Painel de detalhe** (drawer lateral, não modal cheio): título, status, prazo por extenso, projeto, responsável, notas, etapas, regra de origem ("Série X, dia-âncora 20, antecipa" / "Repete a cada 2 semanas às seg e qua" / "Criado à mão"), cobranças, escalonamento, trilha de marcação, e as ações de 3.8. **O painel reflete o estado atual em tempo real**: marcar uma etapa ou mudar status atualiza ali mesmo, sem fechar e reabrir.
- **Estado vazio**: "Tudo em dia por aqui." com ilustração leve, nunca uma tela branca.

Outras telas do módulo:
- **Demandas** (3.10).
- **Séries** (3.3): lista ordenada por dia-âncora, edição inline, "+ Nova série". Read-only com faixa explicativa para quem não tem catálogo.
- **Projetos**: os projetos do Hub escolhidos para o espaço; abre a página do projeto no Hub (onde vive a aba Contatos). Aqui mora a seleção de quais projetos o espaço usa (gestor/catálogo).
- **Feriados**: nacionais (somente leitura) + feriados do espaço (CRUD, catálogo).
- **Equipe**: membros do espaço, papel, checkbox "Projetos e séries" (catálogo), adicionar/remover membro (gestor). Reutilize o cadastro de pessoas do Hub — aqui só se escolhe quem participa e com qual papel.
- **Configurações do espaço**: nome, projetos, aprovação (liga/desliga + SLA), Oráculo (rótulo + URL), presets de criação.

---

## 5. Modelo de dados — sugestão

Adapte a nomenclatura e o estilo (jsonb × colunas) ao padrão do Hub. O essencial é que exista **`espaco_id` em toda tabela de dados** e que o RLS filtre por ele.

```
espacos                 id, nome, usa_aprovacao bool, sla_horas int, oraculo_rotulo, oraculo_url, presets jsonb, criado_em
espaco_membros          espaco_id, usuario_id (do Hub), papel ('gestor'|'equipe'), pode_catalogo bool
espaco_projetos         espaco_id, projeto_id (do Hub)
series                  id, espaco_id, titulo, dia int, modo ('antecipa'|'adia'|'nenhum'), critico, responsavel, projeto_id, notas
compromissos            id, espaco_id, titulo, data, tipo, projeto_id, responsavel, notas, critico, anexo_presente,
                        estado, recorrencia jsonb (frequencia, intervalo, ate, dias_semana[], modo),
                        subtarefas jsonb, visibilidade, permitidos uuid[], criado_por, enviada_aprovacao_em,
                        escalado_em, cobrancas timestamptz[], marked_at, marked_by
ajustes                 espaco_id, id_ocorrencia text (pk composta) — ex.: 'serie:<serie_id>:2026-09' ou '<compromisso_id>@2026-09-15'
                        + os campos de 3.5 (jsonb é razoável aqui)
demandas                id, espaco_id, titulo, descricao, responsavel, inicio, prazo, estado, projeto_id, subtarefas jsonb,
                        visibilidade, permitidos uuid[], criado_por, criado_em, concluida_em, arquivada
feriados_espaco         espaco_id, data, nome, todo_ano bool
projeto_contatos        projeto_id (do Hub), nome, papel, categoria, telefone, email, notas, escalonamento bool
```

Índices por `(espaco_id, data)` / `(espaco_id, prazo)`. Realtime nas tabelas do módulo se o Hub já usa (duas pessoas abertas veem a mudança uma da outra sem refresh).

---

## 6. Segurança (RLS) — obrigatório, não opcional

- **Isolamento por espaço:** toda leitura e escrita exige `espaco_id` ∈ espaços dos quais o usuário é membro. Default da coluna = nunca confiar no cliente; valide na policy.
- **Visibilidade restrita:** em `compromissos` e `demandas`, a leitura também exige `visibilidade = 'espaco'` OU `criado_por = usuário` OU `usuário ∈ permitidos` OU usuário é gestor do espaço.
- **Catálogo:** escrita em `series`, `feriados_espaco`, `espaco_projetos` exige gestor do espaço OU `pode_catalogo`.
- **Aprovação:** se `usa_aprovacao`, a transição `emAprovacao → concluida` por quem não é gestor é rejeitada no banco.
- **Membros e configurações do espaço:** só gestor do espaço (e admin do Hub).
- Funções auxiliares (`sou_membro(espaco)`, `sou_gestor(espaco)`, `pode_ver(linha)`) como `SECURITY DEFINER` para as policies poderem ler a tabela de membros sem recursão.
- Regra de ouro: **nada de segurança só na tela**. O que a interface esconde, o banco recusa.

---

## 7. Migração dos dados do Assistencial

O app atual roda num projeto Supabase próprio. Vamos exportar de lá e importar no Hub, no espaço **"Assistencial"** (gestores: os gestores atuais; membros: a equipe atual; aprovação ligada, 24h; Oráculo pré-configurado — 2.5).

Preveja uma **importação via JSON** (upload de um arquivo por tabela, ou um único arquivo) executada por admin, idempotente, com relatório do que entrou e do que ficou pendente.

Tabelas de origem (todas com uma coluna `data jsonb` por registro + `setor`; importar só `setor = 'assistencial'`):

| Origem | Destino | Observações |
|---|---|---|
| `projects` | `espaco_projetos` | Casar **pelo nome** com os projetos do Hub. Relatar os que não casaram para o admin resolver à mão. Não criar projeto no Hub automaticamente. |
| `tarefas_fixas` | `series` | Campos 1:1 (`chave`→id, `dia`, `titulo`, `modo`, `critico`, `responsavel`). |
| **regras por projeto** (dentro de `projects`) | `series` | O app antigo gerava compromissos automaticamente a partir de campos do projeto. **Isso deixa de existir**; a importação converte cada regra em séries por projeto, para o calendário do Assistencial ficar idêntico ao de hoje — só que agora editável como série. Para cada projeto **ativo**: (a) *"Pagamentos do projeto {nome}"* → dia = `diaLancamento` se existir, senão `diaPagamento − 5` (dias corridos; se ficar ≤ 0, cai no mês anterior — aceite dia-âncora negativo/"−N do fim" ou simplesmente clamp em 1 e relate), modo `antecipa`, **crítico**. Exceção: o projeto `academia` usa dia 1, `antecipa`, título *"Pagamentos do projeto {nome} (Fred, dia 1)"*. (b) *"Iniciar faturamento e cobrar contratante — {nome}"* → só se `dependenciaFaturamento ≠ 'fixo'` e não for `academia`; dia = `diaFaturamentoIniciar` ?? (16 para `asf`, 1 para os demais), modo `adia`. (c) *"Card de faturamento — {nome}"* → só se `dependenciaFaturamento` ∈ {`empenho`, `ordemDeCompra`, `validacaoContratante`, `relatorioContratante`, `escalista`}; é uma série **sem prazo** que **nasce em "Aguardando input do contratante"** (ver campos opcionais em 3.3), com `dependencia_aguardada` = o valor. Responsável de todas = `escalista`. Guardar em `notas` a dependência (`dependenciaFaturamento`) e a aferição (`afericao`) como texto. Além dos projetos, a fixa embutida *"FOPAM de fechamento"* (dia 24, `antecipa`, crítico) vira série; as *"Apresentação — resultados…"* **não** migram. |
| `overrides` | `ajustes` | Reindexar o id: os ids antigos são `tipo:chave:competência` (ex. `fixa:finalizar0600:2026-09`, `lotePagamento:upapalmas:2026-09`); mapear para o id da ocorrência da série criada acima. Manter status, notas, etapas, datas movidas, ocultados, cobranças, escalonamentos e trilha. |
| `manual_obligations` | `compromissos` | 1:1, incluindo `recorrencia`, `subtarefas`, `visibilidade`, `permitidos` (remapear ids de usuário para os do Hub, por e-mail). |
| `contatos` | `projeto_contatos` | `projetos[]` (ids antigos) → projetos do Hub casados na etapa 1. |
| `holidays` | `feriados_espaco` | Só os que não são nacionais. |
| `demandas` | `demandas` | 1:1, remapeando usuários por e-mail. |
| `app_config.oraculoUrl` | `espacos.oraculo_url` | Rótulo "Oráculo da BU Assistencial". |

Validação recomendada: antes de liberar, comparar o mês corrente e o próximo entre o app antigo e o Hub (mesmos títulos nas mesmas datas). Onde divergir, é a conversão de regra em série que precisa de ajuste — corrija a série, não o dado.

---

## 8. Identidade visual e UX

Use o design system do Hub. O que este módulo pede, além disso, é **disciplina**:

- **Cor com significado fixo:** azul (o azul de ação do Hub) = ação e seleção · **vermelho = somente atrasado** · **verde = somente concluído** · aguardando = neutro tracejado · crítico = ênfase tipográfica/borda, não uma cor nova. Nada de arco-íris por tipo de item.
- **Números tabulares** em datas, contadores e progresso (`font-variant-numeric: tabular-nums`).
- **Ritmo, não caixas:** listas como linhas com separadores, não cartões idênticos empilhados; a grade do Mês é uma grade, não 35 cards.
- **Urgência salta da tela:** o contador de atrasadas e a linha de um item atrasado têm mais peso que o resto. "O que eu faço agora?" deve ser óbvio na visão Dia.
- **Toasts com Desfazer** para toda ação destrutiva. **Skeletons** no carregamento, nunca "Carregando…" numa tela vazia. **Estados vazios** com texto humano.
- **Painéis laterais** (drawer) para detalhe e formulários; animação de entrada curta; respeitar `prefers-reduced-motion`.
- **Teclado:** foco visível, Esc fecha painel, Enter salva no formulário.
- **Responsivo:** funciona no celular (Dia e Checklist são as visões mais usadas no celular; Mês pode simplificar para lista por dia em telas estreitas).
- **Tema:** se o Hub tem tema escuro, garanta `color-scheme` coerente para que checkboxes, campos de data e selects nativos apareçam corretamente.
- Textos, rótulos, mensagens de erro e comentários de código em **português**.

---

## 9. O que NÃO entra

- Login, cadastro de usuário, recuperação de senha (é do Hub).
- Cadastro de projetos (é do Hub).
- **Motor automático de obrigações por projeto** (lote de pagamento, faturamento, FOPAM): substituído por séries (7).
- **Setor Comercial Público** (editais, contratos, documentos).
- **Apresentação de Resultados** (competências, orçamento, slides, exportação PDF/PPTX).
- Workflows específicos do faturamento assistencial (ASPA, PIX, ASF, 0600, ZapSign, contrato social com entrantes/saintes). Se o Assistencial precisar, é checklist de etapas numa série.
- Upload de arquivos em obrigações (apenas o flag "anexo presente").

---

## 10. Critérios de aceite

1. Dois usuários em espaços diferentes: nenhum vê nada do outro, inclusive tentando pela API com o token do Hub.
2. Série com dia-âncora 20 e `antecipa`: num mês em que o dia 20 é sábado, a ocorrência aparece na sexta 19 (ou quinta 18 se a sexta for feriado). Mudar para `adia` move para segunda 22.
3. Recorrência semanal a cada 2 semanas, seg e qua, até uma data: as ocorrências certas aparecem; marcar uma etapa numa ocorrência não afeta as outras; "Remover esta data" some só aquele dia; editar a regra reescreve o futuro.
4. Ocultar uma ocorrência de série → some do mês, aparece na faixa "ocultas", Restaurar devolve. Mover de data por arrastar na Semana → aparece na data nova com marcador "movida" e a regra segue intacta nos outros meses.
5. Com aprovação ligada, equipe não consegue concluir a partir de "Em aprovação do Gestor" (tela e banco); gestor consegue. Com aprovação desligada, o status não aparece.
6. Item com visibilidade restrita para a Tayla: o Juliano (mesmo espaço, equipe) não vê nem na lista nem via API; o gestor vê.
7. Marcar etapas: etapa concluída continua visível/editável; "ocultar concluídas" recolhe sem apagar; o painel de detalhe atualiza sem fechar.
8. Demanda com prazo ontem e não concluída aparece como atrasada com "atrasada há 1 dia"; entregue → Arquivar → some das abertas, aparece em Arquivadas, Restaurar devolve.
9. Membro com "Projetos e séries" ligado (sem ser gestor) cria/edita séries e feriados do espaço; sem o flag, a tela fica em modo leitura com o motivo explícito e o banco recusa a escrita.
10. Importação do JSON do Assistencial: o mês corrente e o próximo batem com o app antigo (títulos × datas), status e notas preservados; projetos não casados listados no relatório.
11. Filtros por projeto e responsável funcionam em todas as visões; os contadores do cabeçalho batem com a lista.
12. Card "Calendário Operacional" na home do Hub, com a mesma linguagem visual dos outros três; nada do módulo destoa do Hub.

---

## 11. Liberdade para você (Lovable)

Você conhece o Hub. Decida livremente:
- Como encaixar espaços/papéis no modelo de permissões e de pessoas que o Hub já tem (2.2). Se o Hub já tem "equipes" ou "BUs", um espaço pode simplesmente apontar para uma delas.
- Estilo de persistência (colunas × jsonb), nomes de tabelas, uso de views/funções.
- Componentes: reutilize drawers, tabelas, seletores, toasts e ícones do Hub.
- Navegação do módulo (sidebar própria × abas × menu do Hub).
- Se algo aqui conflitar com um padrão do Hub, **siga o Hub e registre a decisão** num `CALENDARIO_OPERACIONAL.md` na raiz, junto com o que ficou de fora e o porquê.

O que não é negociável: os quatro status com estes nomes; selos derivados e nunca gravados; séries e recorrências calculadas (não materializadas) com ajustes por ocorrência; isolamento por espaço e visibilidade restrita **no banco**; aprovação opcional por espaço; etapas que não somem ao concluir; e a disciplina de cor da seção 8.
