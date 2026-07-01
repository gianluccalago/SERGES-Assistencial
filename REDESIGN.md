# REDESIGN — SERGES · Console Operacional

Auditoria visual profunda + redesign do app SERGES Assistencial (calendário de
obrigações, lotes, faturamentos, contrato social, contatos, Oráculo e Setor
Comercial Público). **Nenhuma funcionalidade, regra, texto de status ou dado
foi alterado** — o redesign é 100% de superfície (tokens, composição,
tipografia, ritmo, microinterações). Motor de obrigações intacto: 38/38 testes
de domínio passando após o redesign; build de produção limpo.

---

## 1. Diagnóstico (vícios de "app feito por IA" encontrados)

### Bugs reais de UI descobertos na auditoria
1. **`.pill` não existia no CSS** — os filtros de estado da visão Lista
   (`ListView`) usavam `className="pill"` sem estilo algum definido: botões
   crus, sem estados. Corrigido: classe `.pill` criada com estados completos.
2. **Toast ilegível no tema escuro** — usava `bg-[var(--color-ink)]` +
   `text-white`; com o tema escuro, `--color-ink` é quase branco → texto
   branco sobre fundo branco. O "Desfazer" (fluxo central do app) estava
   invisível. Corrigido com a classe `.toast` (superfície elevada + botão azul).
3. **Seta do seletor de status invisível** — SVG embutido com stroke `#5B6170`
   (cinza para fundo claro) sobre superfície navy. Recolorida para o token de
   texto suave.
4. **Fonte morta** — `Fredoka` era baixada do Google Fonts em toda carga e
   **nunca usada** (`--font-brand` sem nenhuma referência). Removida.

### Vícios de composição
- **Caixinhas idênticas empilhadas em tudo**: dia, checklist, lista, contatos —
  cada item era um `card` flutuante com a mesma altura, sombra e raio. Ritmo
  monótono, custo de varredura alto, cara de template.
- **Grade do mês = 35 cartões soltos** com `gap` entre eles, cada um com borda
  e sombra próprias — ruído em vez de estrutura de calendário.
- **Cards dentro de cards** (bloco "Aguardando o contratante" com cartões
  dentro de um painel acinzentado com o mesmo raio).
- **Blur/glassmorphism em toda superfície** (`backdrop-filter` em cards E
  botões secundários) — caro de renderizar em listas longas e visualmente
  genérico.
- **Sombra de 14px de raio em cada card** de listas com dezenas de itens.
- **Raios inconsistentes**: 6px, 8px, 12px, 14px e `rounded-full` misturados
  sem critério.
- **Modais/painéis com larguras e paddings divergentes** (460/480/560px;
  overlays 30/40/80% de preto) e **sem animação de entrada** (saltos).

### Vícios de tipografia e hierarquia
- Uma única família (Inter) com pesos quase uniformes; títulos diferiam do
  corpo só por 4–6px. Números importantes (progresso "12/15", contadores,
  datas) sem nenhuma presença tipográfica.
- Contraste AA falhando no texto mais fraco: `--color-ink-faint` antigo
  (#7682A8) sobre superfície ≈ 3,2:1 em texto de 12px.
- `tabular-nums` global existia (bom), mas nada o exibia com hierarquia.

### Vícios de codificação de urgência
- A única codificação era uma borda esquerda de 3px — atrasada, crítica e
  concluída tinham exatamente o mesmo peso visual de linha; "o que eu faço
  agora?" não saltava da tela.
- Contadores do cabeçalho eram 4 chips idênticos — "3 atrasadas" com a mesma
  voz de "mês 12/40".

### Outros
- Emojis e glifos de texto como ícones: `✓`, `✕`, `📎`, `🔗`, `▴▾`.
- Estado de carregamento = texto "Carregando…" centrado em tela branca.
- Botão de menu mobile flutuando sobre o título da página.
- Barra de marcação em lote colada na borda inferior, full-width, sem
  safe-area para celular.
- Sem realce de alvo ao arrastar obrigações (semana/mês).

---

## 2. Direção

**Console operacional premium, escuro-navy, na identidade SERGES.** Régua:
Linear/Stripe — calmo, denso sem apertar, resposta imediata. Premium = ritmo,
alinhamento e contenção de cor; zero decoração.

- **Identidade**: azul SERGES e branco. `#2042E1` vive na marca (logos, slides
  claros da Apresentação); no navy escuro, o azul de **ação** é calibrado para
  contraste (`#4D7DFF`, hover `#7396FF`). Disciplina intocada: azul =
  ação/seleção · vermelho = SÓ atrasado · verde = só concluído.
- **Ousadia gasta onde vale**: superfície de triagem diária (Dia/Checklist) e
  na codificação de urgência. Todo o resto quieto e disciplinado.
- **Slides da Apresentação de Resultados intocados**: escopo claro
  (`.apr-slide`) preserva paleta clara E tipografia original — material curado
  para diretoria não muda de cara.

---

## 3. O novo sistema (theme.css)

### Superfícies — camadas sólidas, sem blur
| Token | Valor | Papel |
|---|---|---|
| `--color-canvas` | `#070D1F` + brilho azul único no topo | fundo |
| `--color-surface-muted` | `#0B1226` | poços rebaixados (kanban, apoio) |
| `--color-surface` | `#0F1830` | cartões e contêineres |
| `--color-surface-2` | `#16224A` | elevados: inputs em foco, cards de kanban, toast, barra de lote |
| `--color-line` / `-strong` | hairlines 14% / 28% | definição vem da linha, não do borrão |

`backdrop-filter` **removido de todos os componentes** (permanece só um
`blur-sm` no cabeçalho sticky). Sombras encurtadas (`0 1px 2px`) — listas com
50 itens ficam leves.

### Tipografia — par com personalidade
- **Space Grotesk** (`--font-display`): títulos h1–h3 e números de presença
  (classe `.display`) — dia gigante da visão Dia, progresso do mês, contadores.
- **Inter** (`--font-ui`): toda a UI densa. Corpo 14px, label 13px, caption
  12px — mais denso que antes, com hierarquia real (display 34px / title 24 /
  heading 19). `tabular-nums` global; colunas numéricas à direita.
- Contraste corrigido: `--color-ink-faint` → `#8891B4` (≥ 4,5:1 nas superfícies).

### Sistema de urgência unificado — `.list-stack` + `.obl-row[data-urgencia]`
Listas de trabalho deixaram de ser cartões soltos: um contêiner único com
linhas separadas por hairline e **trilho de urgência** de 3px à esquerda:

| `data-urgencia` | Sinal |
|---|---|
| `atrasada` | trilho vermelho **+ lavagem vermelha de 7%** no fundo da linha — impõe presença |
| `critico` | trilho azul |
| `aguardando` | trilho tracejado neutro |
| `done` | trilho verde + linha inteira recua para 55% de opacidade |
| `normal` | trilho transparente |

Um helper novo em `format.ts` (`urgenciaAttr`) deriva o valor — mesma lógica
em Dia, Lista, Checklist. `itemAccentClass` continua para contextos de cartão
(semana, aguardando-contratante).

### Estados completos
- Botões com altura única (32px), hover/pressão (`scale(0.99)`),
  `disabled` com opacidade, foco visível em anel azul (`:focus-visible` global).
- `.pill` (novo), `.chip`, `.seg-btn`, `.nav-item` com repouso/hover/ativo.
- `.skeleton` com shimmer para cargas; `.toast` com entrada animada;
  `.drawer`/`.drawer-left` (220ms ease-out) para painéis laterais.
- `.counter[data-alert='true']`: o contador de atrasadas fica vermelho-tint
  quando > 0; os demais ficam quietos.
- Motion: 140–220ms, `cubic-bezier(0.16,1,0.3,1)`; `prefers-reduced-motion`
  respeitado (regra global mantida).
- Scrollbars finas coerentes com o navy; `::selection` azul.

---

## 4. Mudanças por módulo

### Shell (App, Sidebar, Login, carregamento)
- Cabeçalho: contadores com número em Space Grotesk; **"atrasadas" em alerta
  vermelho quando > 0** (`data-alert`), demais discretos.
- Sidebar em `surface-muted` (recua em relação ao conteúdo); item ativo com
  indicador interno de 2px azul; off-canvas mobile com animação e overlay 50%.
- Botão de menu mobile virou alvo de toque de 40px com superfície do tema.
- "Carregando…" substituído por **esqueleto da estrutura da tela** (store) e
  splash com shimmer (AuthGate).
- Login: mais respiro, título em display, logo com destaque.

### Calendário — Dia (a superfície "hoje")
- Cabeçalho-herói **sem caixa**: número do dia em 44px Space Grotesk (azul
  quando é hoje), selo "hoje", progresso `N/M` em display com contagem de
  atrasadas ao lado, barra de progresso fina animada.
- Obrigações do dia em `.list-stack` com trilhos de urgência.
- Bloco "Aguardando o contratante" virou poço rebaixado (`.well`) — hierarquia
  clara entre plano principal e secundário.

### Calendário — Semana
- "Hoje" marcado por trilho azul (não mais um anel de 2px na caixa inteira).
- Números dos dias em display; **enquanto um item é arrastado, todas as linhas
  de dia mostram contorno tracejado de alvo** (affordance de soltar).

### Calendário — Mês
- **Uma grade única** (`.month-grid`/`.month-cell`): hairlines internas,
  células vazias rebaixadas, hover sutil por célula — acabaram os 35 cartões.
- Itens do dia: chips compactos com trilho de urgência, hover azul-tint,
  `cursor-grab`; "+N mais" virou link azul discreto.
- Mobile mantém a agenda por dia (bloco por data), agora nos novos tokens.

### Calendário — Lista
- Filtros de estado agora com a `.pill` estilizada (ativo azul-tint).
- Itens como linhas (`variant="list"` do ObligationCard renderiza `.obl-row`)
  dentro de `.list-stack` — inclusive nos agrupamentos por lote de pagamento.

### Checklist mensal
- Cartão de progresso com **número gigante em display** + barra fina + a
  varredura por projeto separada por hairline (verde só quando completo).
- Semanas em `.list-stack`; linhas com checkbox de 20px e trilho de urgência.
- **Barra de marcação em lote flutuante**: cartão elevado com contagem em
  display azul, `max-width` de leitura, `safe-area-inset-bottom` (mobile).
- Chevrons de expandir/recolher viraram ícones animados (rotate 150ms).

### Detalhe da obrigação + formulários
- Painel lateral desliza (`.drawer`), overlay 50%, hairline na borda.
- Fechar (✕ de texto) → ícone SVG com `aria-label`.
- Aviso de contrato social no lote: banner vermelho-tint com ícone de alerta
  (antes: card com borda vermelha e texto vermelho puro).
- Aviso de modo leitura (AdminGuard): banner azul-tint com cadeado.
- Painéis de workflow (ASF, 0600, ZapSign, contrato social, FOPAM) herdam o
  sistema; checkboxes com accent azul.

### Contatos
- Seções viraram `.list-stack` com linhas — varredura em coluna, ações
  (WhatsApp/E-mail/Outlook) alinhadas à direita, sem caixinhas.

### Setor Comercial Público
- Colunas do funil e do kanban de contratos viraram **poços rebaixados**
  (`.well`) — os cards (em `surface-2`) agora flutuam DENTRO de algo, com
  profundidade real de kanban.
- Cards: hover com elevação de 2px + hairline forte (sem sombra estourada).
- Cores de fase (tons luminosos, estilo badge) mantidas.
- Anexos: emojis 📎/🔗 → ícones SVG de clipe/link.

### Apresentação de Resultados
- Chrome (lista de competências, editor) herda o novo sistema.
- **Slides não mudam**: `.apr-slide` fixa paleta clara e tipografia Inter
  original — impressão/projeção/PPTX idênticos ao aprovado.

---

## 5. O que explicitamente NÃO mudou
- Motor de prazos (pagamento −5 corridos, antecipação, feriados), os 4 status
  e selos derivados, lotes, guardrails, resoluções de mês com carry-forward,
  sub-workflow ASF, 0600, ZapSign, contrato social com gates, checklist
  sincronizado, marcação em lote, desfazer via toast, contatos wa.me/mailto,
  importadores, todo o Comercial, papéis gestor/equipe e bloqueios explicados.
- Nomes de status, ações e módulos; nenhuma microcopy alterada nesta rodada.
- Supabase: zero mudanças de schema/dados; nenhuma lib de runtime adicionada
  (a única adição foi a fonte Space Grotesk — e a Fredoka, morta, saiu).

## 6. Verificação
- `npm test` — **38/38** testes de domínio (motor de obrigações e workflows)
  passando após o redesign.
- `npm run build` — produção limpa (tsc + vite).
- Revisão manual de cada arquivo alterado: mudanças restritas a
  className/markup de apresentação; nenhum handler, estado ou prop de dados
  alterado (exceção: `ObligationCard` passou a **ler** a prop `variant` que já
  recebia e era ignorada).
- Pendente de validação visual no deploy (ambiente sem navegador): contraste
  fino do trilho tracejado, grade do mês em telas estreitas e o PPTX/PDF da
  Apresentação (não deve ter mudado nada — conferir).

## 7. Arquivos tocados
`index.html` · `src/ui/theme/theme.css` (reescrito) · `src/ui/format.ts` ·
`src/App.tsx` · `src/state/store.tsx` · `src/auth/AuthGate.tsx` ·
`components/`: Sidebar, LoginScreen, Toast, TudoEmDia, OcultadasBar, DayView,
WeekView, MonthView, ListView, ChecklistView, ObligationCard, ObligationDetail,
ManualForm, StatusSelector, WorkflowPanels, ContatosPage, AdminGuard ·
`comercial/`: ComercialPage, shared.
