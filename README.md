# SERGES · Calendário de Obrigações

Aplicativo interno do cargo de Assistente de Projetos da SERGES. O calendário
não é uma lista fixa escrita à mão: um **motor data-driven** deriva os prazos a
partir dos dados de cada projeto e das regras de negócio. Mudou a data de
pagamento, entrou ou saiu projeto, adicionou feriado municipal — o calendário
se reajusta sozinho.

## Stack

- React 18 + TypeScript via Vite
- Tailwind CSS v4 (tokens em `@theme`) — tema **Serges**, claro, azul e branco
- Domínio em TS puro, isolado e testável (date-fns só para aritmética)
- Persistência local `localStorage` versionada (schema v2) — sem backend
- Testes com Vitest

## Scripts

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run typecheck  # tsc --noEmit
npm test           # testes do motor (Vitest)
npm run build      # typecheck + build de produção
```

## Arquitetura

- `src/domain` — tipos, motor de regras (`engine.ts`), aplicação de overrides e
  merge de manuais (`resolve.ts`), utilitários de data, feriados e máquina de
  estados. Camada pura, sem UI nem persistência.
- `src/domain/__tests__` — cobre os critérios de aceite (jul/2026, mai/2026,
  dependência de terceiro, atraso, overrides e obrigações manuais).
- `src/data` — seed dos projetos e feriados extras.
- `src/state` — persistência versionada (projetos + overrides + manuais) e store.
- `src/ui` — telas, componentes e o design system (`theme/theme.css`).
- `src/assets` — logos da marca (`azul_1.svg`, `serges-square.svg`).

A camada de domínio é independente: uma API REST pode ser adicionada depois sem
reescrever as regras.

## Modelo: regras + overrides + manuais

- **Obrigações geradas**: derivadas pelas regras, com id estável
  `tipo:chave:competência` (ex.: `cardPagamento:asf:2026-07`).
- **Override**: ajuste manual sobre uma obrigação gerada, indexado pelo id.
  `dataNova` vence a data derivada (move sem apagar a regra); `dismissed` esconde
  sem recriar no mês (com desfazer); guarda também estado, anexo e notas.
- **ManualObligation**: obrigação criada do zero pelo usuário; registro de
  primeira classe, editável e removível livremente.

## Regras-chave do motor

- **Prazos críticos antecipam**: cards prontos, 0600 e FOPAM que caem em dia não
  útil recuam para o dia útil anterior. Nunca adiam.
- **Pagamentos e datas genéricas adiam**: seguem o próximo dia útil.
- **Regra dos 5 dias**: card de pagamento = dia nominal − 5 dias corridos.
- **Dependência de terceiro**: cards de faturamento nascem em `aguardandoRetorno`,
  sem prazo, e não viram atrasados sozinhos; viram tarefa ao registrar o retorno.

## Interface

- Três modos: **semana** (padrão, espaçoso), **mês** (grade ampla com "+N mais" e
  agenda enxuta no celular) e **lista** (filtrável por estado). Filtros por
  projeto e escalista nos três modos.
- Ações no detalhe: concluir, cobrança, escalar, registrar retorno, anexar
  planilha, mover de data, excluir, notas.
- Mover por arrastar-e-soltar na grade (semana/mês) e por edição de data no
  detalhe (toque). Botão **Nova obrigação** sempre visível.
- Administração de projetos e feriados. Anexo da planilha é pré-requisito para
  concluir cards de pagamento.
- Responsivo para desktop e celular.

## Marca

Os arquivos de logo ficam em `src/assets` (`azul_1.svg` lockup horizontal,
`serges-square.svg` símbolo/favicon), na cor de marca `#2042E1`. O wordmark do
cabeçalho é composto com a fonte arredondada Fredoka para escalar com nitidez.
