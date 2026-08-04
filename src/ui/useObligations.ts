import { useMemo } from 'react';
import { useStore } from '../state/store';
import { resolveEstado, marcadores, aprovacaoEstourou, podeConcluir } from '../domain/stateMachine';
import type { CalendarItem, ObligationEstado } from '../domain/types';
import { todayISO } from './format';

export interface ResolvedObligation {
  item: CalendarItem;
  /** Status (um dos quatro). */
  estado: ObligationEstado;
  /** Marcadores derivados (selos). */
  atrasada: boolean;
  contratanteAtrasado: boolean;
  critico: boolean;
  escalado: boolean;
  cobrancasCount: number;
  prazo?: string;
  aprovacaoEstourada: boolean;
  podeConcluir: boolean;
}

export function resolveItem(item: CalendarItem, today: string, nowISO: string): ResolvedObligation {
  const m = marcadores(item, today);
  return {
    item,
    estado: resolveEstado(item),
    atrasada: m.atrasada,
    contratanteAtrasado: m.contratanteAtrasado,
    critico: m.critico,
    escalado: !!item.escalado,
    cobrancasCount: item.cobrancasCount ?? 0,
    prazo: item.prazo,
    aprovacaoEstourada:
      item.baseEstado === 'emAprovacao' && aprovacaoEstourou(item.enviadaAprovacaoEm, nowISO),
    podeConcluir: podeConcluir(item),
  };
}

/**
 * Reidrata o item aberto no painel a partir do estado atual.
 *
 * O painel de detalhe recebe o item que estava na tela no momento do clique. Se
 * ficar preso nessa foto, marcar uma etapa ou trocar o status não aparece até
 * fechar e reabrir o card. Aqui devolvemos sempre a versão viva: procuramos o
 * mesmo id entre os itens do mês exibido e, quando o item é de outro mês (a
 * visão Semana atravessa meses), no mês dele. Sem achar, devolve o que veio —
 * pior caso é o comportamento antigo, nunca uma tela vazia.
 */
export function reidratarSelecionado(
  selecionado: ResolvedObligation | null,
  itensDoMes: ResolvedObligation[],
  buscarNoMes: (year: number, month: number) => ResolvedObligation[],
): ResolvedObligation | null {
  if (!selecionado) return null;
  const id = selecionado.item.id;
  const naTela = itensDoMes.find((x) => x.item.id === id);
  if (naTela) return naTela;
  const ref = selecionado.prazo ?? `${selecionado.item.competencia}-01`;
  const y = Number(ref.slice(0, 4));
  const m = Number(ref.slice(5, 7));
  if (!y || !m) return selecionado;
  return buscarNoMes(y, m).find((x) => x.item.id === id) ?? selecionado;
}

export function useMonthObligations(year: number, month: number): ResolvedObligation[] {
  const store = useStore();
  const today = todayISO();
  const nowISO = new Date().toISOString();

  return useMemo(() => {
    return store.itemsFor(year, month).map((item) => resolveItem(item, today, nowISO));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state, year, month, today]);
}
