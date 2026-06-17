import type { ObligationEstado, ObligationTipo, DependenciaFaturamento } from '../domain/types';
import { fromISODate } from '../domain/dateUtils';

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const DOW_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const DOW_LONGO = [
  'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
];

export const ESTADO_LABEL: Record<ObligationEstado, string> = {
  pendente: 'Pendente',
  aguardandoInput: 'Aguardando input do contratante',
  emAprovacao: 'Em aprovação do Gestor',
  concluida: 'Concluído',
};

export const TIPO_LABEL: Record<ObligationTipo, string> = {
  lotePagamento: 'Lote de pagamento',
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

export function formatDateShort(iso: string): string {
  const d = fromISODate(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Chip do status (um dos quatro). Disciplina: azul = ação/seleção, verde done
 * discreto; aguardando é neutro tracejado. "Atrasada" é selo à parte (vermelho).
 */
export function estadoChipClass(estado: ObligationEstado): string {
  switch (estado) {
    case 'concluida':
      return 'chip text-[var(--color-done)] border-[var(--color-done)]';
    case 'emAprovacao':
      return 'chip bg-[var(--color-serges-blue-tint)] border-[var(--color-serges-blue)] text-[var(--color-serges-blue)]';
    case 'aguardandoInput':
      return 'chip border-dashed text-[var(--color-ink-soft)]';
    default:
      return 'chip';
  }
}

/** Classe da borda lateral / acento conforme marcadores. */
export function itemAccentClass(p: { atrasada?: boolean; concluido?: boolean; critico?: boolean }): string {
  if (p.atrasada) return 'border-l-[3px] border-l-[var(--color-overdue)]';
  if (p.concluido) return 'border-l-[3px] border-l-[var(--color-done)] opacity-70';
  if (p.critico) return 'border-l-[3px] border-l-[var(--color-serges-blue)]';
  return 'border-l-[3px] border-l-transparent';
}
