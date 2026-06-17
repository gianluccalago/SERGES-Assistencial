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
  const semAtuacao = item.resolucaoMes === 'semAtuacao';
  return {
    atrasada: past && !concluido && !aguardando && !semAtuacao,
    contratanteAtrasado: past && aguardando && !semAtuacao,
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
 * Motivo pelo qual a conclusão está bloqueada, ou null se pode concluir (§4.5).
 * Sempre explicar o bloqueio na interface; nunca um botão apagado sem motivo.
 */
export function bloqueioConclusao(item: CalendarItem): string | null {
  if (item.baseEstado === 'concluida') return null;
  if (item.baseEstado === 'aguardandoInput') {
    return 'Aguarda o contratante: registre o retorno em vez de concluir.';
  }
  if (item.id.startsWith('fixa:contratoSocialContabilidade:')) {
    const cs = item.contratoSocial;
    if (!cs?.confirmacaoEscalistas) {
      return 'Confirme a lista de entradas e saídas com os escalistas (Rodrigo e Danneline).';
    }
    const { ok, total } = contratoSocialProgresso(item);
    if (ok < total) return `Faltam procuração e boleto dos médicos entrantes (${ok} de ${total}).`;
  }
  return null;
}

/** Progresso dos entrantes do contrato social: procuração + boleto por médico. */
export function contratoSocialProgresso(item: CalendarItem): { ok: number; total: number } {
  const ent = item.contratoSocial?.entrantes ?? [];
  return { ok: ent.filter((e) => e.procuracao && e.boleto).length, total: ent.length };
}

/** Texto curto de progresso para a linha da obrigação (contrato social). */
export function progressoTexto(item: CalendarItem): string | null {
  if (item.id.startsWith('fixa:contratoSocialContabilidade:')) {
    const { ok, total } = contratoSocialProgresso(item);
    return total > 0 ? `procurações e boletos ${ok} de ${total}` : null;
  }
  return null;
}

export function podeConcluir(item: CalendarItem): boolean {
  return bloqueioConclusao(item) === null;
}
