import type { CalendarItem, ObligationEstado, Override } from './types';
import { fromISODate } from './dateUtils';

/**
 * O status efetivo é o próprio status-base (um dos quatro). "Atrasada" e
 * "Crítico" são marcadores derivados (selos), não status — ver `marcadores`.
 */
export function resolveEstado(item: CalendarItem): ObligationEstado {
  return item.baseEstado;
}

/**
 * Marcadores derivados que coexistem com o status (§4.5):
 * - atrasada: tem prazo, hoje passou e não está concluído nem aguardando o
 *   contratante (atraso "por culpa nossa").
 * - contratanteAtrasado: aguardando input e o prazo de cobrança passou — não é
 *   culpa nossa, mas sinaliza para reforçar a cobrança.
 */
export function marcadores(
  item: CalendarItem,
  hojeISO: string,
): { atrasada: boolean; contratanteAtrasado: boolean; critico: boolean } {
  const past = item.prazo
    ? fromISODate(hojeISO).getTime() > fromISODate(item.prazo).getTime()
    : false;
  const concluido = item.baseEstado === 'concluida';
  const aguardando = item.baseEstado === 'aguardandoInput';
  return {
    atrasada: past && !concluido && !aguardando,
    contratanteAtrasado: past && aguardando,
    critico: !!item.critico,
  };
}

/** Registra uma cobrança (ação "Cobrar", §4.5). Não muda o status. */
export function registrarCobranca(cobrancas: string[] | undefined, agoraISO: string): string[] {
  return [...(cobrancas ?? []), agoraISO];
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

/** Reexporta o tipo para conveniência. */
export type { ObligationEstado };

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
  if (item.baseEstado === 'aguardandoInput') return false;
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
