# SERGES · Calendário de Obrigações

Aplicativo interno do cargo de Assistente de Projetos da SERGES. O calendário
não é uma lista fixa de dias escrita à mão: um **motor data-driven** deriva os
prazos a partir dos dados de cada projeto e das regras de negócio. Mudou a data
de pagamento, entrou ou saiu projeto, adicionou feriado municipal — o calendário
se reajusta sozinho.

## Stack

- React 18 + TypeScript via Vite
- Tailwind CSS v4 (tokens em `@theme`, design system Cron adaptado para app)
- Domínio em TS puro, isolado e testável (date-fns só para aritmética)
- Persistência local em `localStorage`, schema versionado — sem backend
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

- `src/domain` — tipos, motor de regras (`engine.ts`), utilitários de data
  (`dateUtils.ts`), feriados (`holidays.ts`) e máquina de estados
  (`stateMachine.ts`). Sem dependência de UI ou de persistência.
- `src/domain/__tests__` — cobre os critérios de aceite (jul/2026, mai/2026,
  dependência de terceiro, regra de atraso).
- `src/data` — seed dos projetos e feriados extras.
- `src/state` — persistência versionada e store da aplicação (React Context).
- `src/ui` — telas, componentes e o design system (`theme/theme.css`).

A camada de domínio é pura e independente: uma API REST pode ser adicionada
depois alimentando o mesmo `deriveObligations` sem reescrever as regras.

## Regras-chave do motor

- **Antecipação de prazos críticos**: prazos internos de fechamento (cards
  prontos, 0600, FOPAM) que caem em dia não útil **antecipam** para o dia útil
  anterior. Nunca adiam.
- **Pagamentos e datas genéricas**: quando caem em dia não útil, seguem o
  **próximo** dia útil.
- **Regra dos 5 dias**: card de pagamento = dia nominal de pagamento − 5 dias
  corridos (antecipa se cair em dia não útil). Vale para todos os projetos.
- **Dependência de terceiro**: cards de faturamento que dependem de empenho,
  ordem de compra, validação ou relatório nascem em `aguardandoRetorno`, sem
  prazo, e **não** viram atrasados pela passagem do tempo. Só após registrar o
  retorno viram tarefa com prazo.
- **id estável e determinístico**: `tipo:chave:competência`
  (ex.: `cardPagamento:asf:2026-07`), para o estado do usuário persistir entre
  sessões.

## Funcionalidades

Calendário mensal navegável, lista por estado com filtros (estado, projeto,
escalista), detalhe com ações (concluir, cobrar, escalar, registrar retorno,
enviar para aprovação 24h), administração de projetos e feriados, registro de
eventos avulsos e anexo obrigatório da planilha de origem nos cards de pagamento.
