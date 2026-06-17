import { useMemo } from 'react';
import { useStore } from '../state/store';
import { resolveEstado, aprovacaoEstourou, podeConcluir } from '../domain/stateMachine';
import type { Obligation, ObligationEstado, ObligationUserState } from '../domain/types';
import { todayISO } from './format';

export interface ResolvedObligation {
  obligation: Obligation;
  userState: ObligationUserState | undefined;
  estado: ObligationEstado;
  /** Prazo efetivo (calculado ou manual). */
  prazo?: string;
  aprovacaoEstourada: boolean;
  podeConcluir: boolean;
}

export function useMonthObligations(year: number, month: number): ResolvedObligation[] {
  const store = useStore();
  const today = todayISO();
  const nowISO = new Date().toISOString();

  return useMemo(() => {
    const raw = store.obligationsFor(year, month);
    return raw.map((obligation) => {
      const userState = store.state.obligationStates[obligation.id];
      return {
        obligation,
        userState,
        estado: resolveEstado(obligation, userState, today),
        prazo: obligation.prazoCalculado ?? userState?.prazoManual,
        aprovacaoEstourada: aprovacaoEstourou(userState, nowISO),
        podeConcluir: podeConcluir(obligation, userState),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state, year, month, today]);
}
