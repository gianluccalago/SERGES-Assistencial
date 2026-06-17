import { useMemo } from 'react';
import { useStore } from '../state/store';
import { resolveEstado, aprovacaoEstourou, podeConcluir } from '../domain/stateMachine';
import type { CalendarItem, ObligationEstado } from '../domain/types';
import { todayISO } from './format';

export interface ResolvedObligation {
  item: CalendarItem;
  estado: ObligationEstado;
  prazo?: string;
  aprovacaoEstourada: boolean;
  podeConcluir: boolean;
}

export function resolveItem(item: CalendarItem, today: string, nowISO: string): ResolvedObligation {
  return {
    item,
    estado: resolveEstado(item, today),
    prazo: item.prazo,
    aprovacaoEstourada: aprovacaoEstourou(item.enviadaAprovacaoEm, nowISO),
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
