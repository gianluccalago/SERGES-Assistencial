import type { ObligationEstado, ObligationTipo, DependenciaFaturamento } from '../domain/types';
import { fromISODate } from '../domain/dateUtils';

export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export const ESTADO_LABEL: Record<ObligationEstado, string> = {
  pendente: 'Pendente',
  emCobranca: 'Em cobrança',
  aguardandoRetorno: 'Aguardando retorno',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  escalada: 'Escalada',
};

export const TIPO_LABEL: Record<ObligationTipo, string> = {
  cardPagamento: 'Card de pagamento',
  faturamentoIniciar: 'Iniciar faturamento',
  faturamentoCard: 'Card de faturamento',
  fixa: 'Tarefa fixa',
  apresentacao: 'Apresentação',
  fechamento: 'Fechamento',
  evento: 'Evento',
};

export const DEP_LABEL: Record<DependenciaFaturamento, string> = {
  nenhuma: 'Nenhuma',
  fixo: 'Valor fixo',
  empenho: 'Empenho',
  ordemDeCompra: 'Ordem de compra',
  validacaoContratante: 'Validação do contratante',
  relatorioContratante: 'Relatório do contratante',
  escalista: 'Retorno do escalista',
};

export function formatDateLong(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Classes utilitárias para o visual de cada estado, seguindo a disciplina
 * monocromática: somente "atrasada" usa o acento ember.
 */
export function estadoChipClass(estado: ObligationEstado): string {
  switch (estado) {
    case 'atrasada':
      return 'chip border-[var(--color-ember)] text-[var(--color-ember)]';
    case 'concluida':
      return 'chip opacity-50 line-through';
    case 'emCobranca':
      return 'chip text-[var(--color-bone)] border-[var(--color-ash)]';
    case 'escalada':
      return 'chip text-[var(--color-bone)] uppercase tracking-wide';
    case 'aguardandoRetorno':
      return 'chip border-dashed opacity-75';
    default:
      return 'chip';
  }
}
