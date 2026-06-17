import type { CalendarItem, ObligationEstado, Override } from './types';
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
 * Resolve o estado efetivo de um item combinando o estado-base e a regra de
 * atraso relativa a "hoje".
 *
 * Regras:
 * - Estados terminais escolhidos pelo usuário (concluída/escalada) têm precedência.
 * - Um item com prazo vira 'atrasada' quando hoje > prazo e não está concluído.
 * - Itens em 'aguardandoRetorno' nunca viram 'atrasada' sozinhos.
 */
export function resolveEstado(item: CalendarItem, hojeISO: string): ObligationEstado {
  const base = item.baseEstado;
  if (base === 'concluida') return 'concluida';
  if (base === 'escalada') return 'escalada';
  if (base === 'aguardandoRetorno') return 'aguardandoRetorno';

  if (item.prazo) {
    const venceu = fromISODate(hojeISO).getTime() > fromISODate(item.prazo).getTime();
    if (venceu) return 'atrasada';
  }
  return base;
}

/**
 * Registra o recebimento de um retorno de terceiro: produz um Override que move
 * o faturamentoCard de 'aguardandoRetorno' para 'pendente'. O prazo passa a ser
 * o informado (dataNova) ou imediato (a própria data de recebimento).
 */
export function registrarRetorno(
  override: Override | undefined,
  recebidoEmISO: string,
  prazo?: string,
): Override {
  return {
    ...override,
    estado: 'pendente',
    retornoRecebidoEm: recebidoEmISO,
    dataNova: prazo ?? recebidoEmISO,
  };
}

/**
 * Indica se um item enviado para aprovação já passou da expectativa de 24h de
 * retorno do coordenador/gestor.
 */
export function aprovacaoEstourou(enviadaAprovacaoEm: string | undefined, agoraISO: string): boolean {
  if (!enviadaAprovacaoEm) return false;
  const enviada = new Date(enviadaAprovacaoEm).getTime();
  const agora = new Date(agoraISO).getTime();
  return agora - enviada > 24 * 60 * 60 * 1000;
}

/**
 * Regras para marcar como pronto/concluído.
 * - Itens aguardando retorno de terceiro NÃO podem ser concluídos direto; a
 *   ação é registrar o retorno (§11.11).
 * - Cards de pagamento exigem o mini-checklist de guardrails (§11.2):
 *   anexo da planilha + confirmação ASPA + conferência de PIX.
 */
export function podeConcluir(item: CalendarItem): boolean {
  if (item.baseEstado === 'aguardandoRetorno') return false;
  if (item.tipo === 'cardPagamento') {
    return item.anexoPresente === true && item.aspaConfirmado === true && item.pixConferido === true;
  }
  return true;
}

/** Itens que faltam no guardrail do card de pagamento, para exibir o checklist. */
export function guardrailsCardPagamento(item: CalendarItem): {
  anexo: boolean;
  aspa: boolean;
  pix: boolean;
  completo: boolean;
} {
  const anexo = item.anexoPresente === true;
  const aspa = item.aspaConfirmado === true;
  const pix = item.pixConferido === true;
  return { anexo, aspa, pix, completo: anexo && aspa && pix };
}
