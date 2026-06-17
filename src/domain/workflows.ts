import type { AsfSubEstado, ManualObligation } from './types';
import { fromISODate, toISODate, utcDate } from './dateUtils';

const MESES_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Competência do mês seguinte a uma competência YYYY-MM (§4.5, faturamento parcial).
 */
export function proximaCompetencia(comp: string): string {
  const [y, m] = comp.split('-').map(Number);
  const idx = y * 12 + (m - 1) + 1;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** Texto da recuperação a carregar: "referente ao mês de <mês anterior por extenso>". */
export function textoRecuperacao(compAnterior: string): string {
  const [, m] = compAnterior.split('-').map(Number);
  return `Recuperar valor referente ao mês de ${MESES_EXTENSO[m - 1]}`;
}

// Lógica pura das extensões de workflow (§11). Sem dependência de UI.

/** Ordem linear do sub-workflow da ASF (§11.3). */
export const ASF_FLOW: AsfSubEstado[] = [
  'enviadoADaniela',
  'correcoesSolicitadas',
  'emCorrecaoPeloRodrigo',
  'aprovado',
];

export const ASF_LABEL: Record<AsfSubEstado, string> = {
  enviadoADaniela: 'Enviado à Daniela',
  correcoesSolicitadas: 'Correções solicitadas',
  emCorrecaoPeloRodrigo: 'Em correção pelo Rodrigo',
  aprovado: 'Aprovado',
};

export function asfNext(e: AsfSubEstado | undefined): AsfSubEstado | undefined {
  const i = e ? ASF_FLOW.indexOf(e) : -1;
  return ASF_FLOW[i + 1];
}

export function asfPrev(e: AsfSubEstado | undefined): AsfSubEstado | undefined {
  const i = e ? ASF_FLOW.indexOf(e) : -1;
  return i > 0 ? ASF_FLOW[i - 1] : undefined;
}

export function asfAprovado(e: AsfSubEstado | undefined): boolean {
  return e === 'aprovado';
}

/**
 * Cálculo de apoio para notas fracionadas (§11.5): dado um valor total e o teto
 * por nota, retorna em quantas notas dividir e o valor por nota.
 */
export function notasFracionadas(total: number, teto: number): { quantidade: number; valorPorNota: number } {
  if (teto <= 0 || total <= 0) return { quantidade: 0, valorPorNota: 0 };
  const quantidade = Math.ceil(total / teto);
  const valorPorNota = Math.round((total / quantidade) * 100) / 100;
  return { quantidade, valorPorNota };
}

/** Rejeita mais de duas casas decimais (§11.4). */
export function maxDuasCasas(value: string): boolean {
  if (value.trim() === '') return true;
  return /^\d+([.,]\d{1,2})?$/.test(value.trim());
}

/**
 * Gera o card de devolução do contrato social na saída (§11.7): R$ 50, sem
 * prazo crítico, lançado no mês seguinte à data de referência.
 */
export function cardDevolucaoContratoSocial(refISO: string, projetoId?: string): ManualObligation {
  const ref = fromISODate(refISO);
  const proximo = utcDate(ref.getUTCFullYear(), ref.getUTCMonth() + 2, 1); // mês seguinte, dia 1
  return {
    id: `manual:devolucao:${Date.now()}`,
    titulo: 'Devolução do contrato social (R$ 50)',
    data: toISODate(proximo),
    tipo: 'evento',
    projetoId,
    estado: 'pendente',
    notas: 'Saída do contrato social: card de R$ 50 sem prazo crítico, pode ir para o mês seguinte (§11.7).',
    critico: false,
  };
}
