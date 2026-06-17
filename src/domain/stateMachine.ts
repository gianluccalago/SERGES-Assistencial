import type { CalendarItem, MedicoCard, ObligationEstado, Override } from './types';
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

/** Um card de médico está "pronto" quando os guardrails fundamentais batem (§11.2). */
export function medicoPronto(m: MedicoCard): boolean {
  return m.anexoPresente === true && m.pixConferido === true;
}

/** Progresso do lote de pagamento: cards prontos e aprovados sobre o total. */
export function loteProgresso(item: CalendarItem): { ok: number; total: number } {
  const medicos = item.medicos ?? [];
  return {
    ok: medicos.filter((m) => medicoPronto(m) && m.aprovado === true).length,
    total: medicos.length,
  };
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
  if (item.tipo === 'lotePagamento') {
    const { ok, total } = loteProgresso(item);
    if (total === 0) return 'Adicione os cards de médico do lote antes de concluir.';
    if (ok < total) return `Faltam cards de médico prontos e aprovados (${ok} de ${total}).`;
  }
  return null;
}

export function podeConcluir(item: CalendarItem): boolean {
  return bloqueioConclusao(item) === null;
}
