import type { Obligation, ObligationEstado, ObligationUserState } from './types';
import { fromISODate } from './dateUtils';

/** Transições manuais permitidas ao usuário. */
const TRANSICOES_MANUAIS: Record<ObligationEstado, ObligationEstado[]> = {
  pendente: ['emCobranca', 'escalada', 'concluida'],
  emCobranca: ['escalada', 'concluida', 'pendente'],
  aguardandoRetorno: ['emCobranca', 'escalada', 'concluida'],
  atrasada: ['emCobranca', 'escalada', 'concluida'],
  escalada: ['concluida', 'emCobranca'],
  concluida: ['pendente'],
};

export function podeTransicionar(de: ObligationEstado, para: ObligationEstado): boolean {
  return TRANSICOES_MANUAIS[de]?.includes(para) ?? false;
}

/**
 * Resolve o estado efetivo de uma obrigação combinando o estado-base derivado,
 * a sobreposição do usuário e a regra de atraso relativa a "hoje".
 *
 * Regras:
 * - Estado marcado pelo usuário tem precedência sobre o estado-base.
 * - Uma obrigação com prazo vira 'atrasada' quando hoje > prazo e ela não está
 *   concluida/escalada/emCobranca por escolha do usuário.
 * - Obrigações em 'aguardandoRetorno' nunca viram 'atrasada' sozinhas.
 */
export function resolveEstado(
  obligation: Obligation,
  user: ObligationUserState | undefined,
  hojeISO: string,
): ObligationEstado {
  const userEstado = user?.estado;

  // Estados terminais/explícitos do usuário têm precedência.
  if (userEstado === 'concluida') return 'concluida';
  if (userEstado === 'escalada') return 'escalada';

  const base = userEstado ?? obligation.estado;

  // Aguardando retorno de terceiro não vira atrasada pela passagem do tempo.
  if (base === 'aguardandoRetorno') return 'aguardandoRetorno';

  const prazo = obligation.prazoCalculado ?? user?.prazoManual;
  if (prazo) {
    const venceu = fromISODate(hojeISO).getTime() > fromISODate(prazo).getTime();
    if (venceu) return 'atrasada';
  }

  return base;
}

/**
 * Registra o recebimento de um retorno de terceiro: move o faturamentoCard de
 * 'aguardandoRetorno' para 'pendente'. O prazo passa a ser o informado pelo
 * usuário (prazoManual) ou imediato (a própria data de recebimento).
 */
export function registrarRetorno(
  user: ObligationUserState | undefined,
  recebidoEmISO: string,
  prazoManual?: string,
): ObligationUserState {
  return {
    ...user,
    estado: 'pendente',
    retornoRecebidoEm: recebidoEmISO,
    prazoManual: prazoManual ?? recebidoEmISO,
  };
}

/**
 * Indica se uma obrigação enviada para aprovação já passou da expectativa de
 * 24 horas de retorno do coordenador/gestor.
 */
export function aprovacaoEstourou(
  user: ObligationUserState | undefined,
  agoraISO: string,
): boolean {
  if (!user?.enviadaAprovacaoEm) return false;
  const enviada = new Date(user.enviadaAprovacaoEm).getTime();
  const agora = new Date(agoraISO).getTime();
  return agora - enviada > 24 * 60 * 60 * 1000;
}

/**
 * Pré-requisito de cards de pagamento: sem o anexo da planilha de origem do
 * valor, a obrigação não pode ser marcada como pronta/concluída.
 */
export function podeConcluir(obligation: Obligation, user: ObligationUserState | undefined): boolean {
  if (obligation.tipo === 'cardPagamento') {
    return user?.anexoPlanilha === true;
  }
  return true;
}
