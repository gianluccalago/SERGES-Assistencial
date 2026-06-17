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

export function useMonthObligations(year: number, month: number): ResolvedObligation[] {
  const store = useStore();
  const today = todayISO();
  const nowISO = new Date().toISOString();

  return useMemo(() => {
    return store.itemsFor(year, month).map((item) => resolveItem(item, today, nowISO));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state, year, month, today]);
}
