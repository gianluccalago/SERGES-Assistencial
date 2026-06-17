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

export function formatDateShort(iso: string): string {
  const d = fromISODate(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Classes do chip de estado. Disciplina: azul = ação/seleção, vermelho overdue
 * é o único alerta, verde done é discreto; o resto é neutro.
 */
export function estadoChipClass(estado: ObligationEstado): string {
  switch (estado) {
    case 'atrasada':
      return 'chip border-[var(--color-overdue)] text-[var(--color-overdue)]';
    case 'concluida':
      return 'chip text-[var(--color-done)] border-[var(--color-done)]';
    case 'emCobranca':
      return 'chip bg-[var(--color-serges-blue-tint)] border-[var(--color-serges-blue)] text-[var(--color-serges-blue)]';
    case 'escalada':
      return 'chip bg-[var(--color-serges-blue)] border-[var(--color-serges-blue)] text-white uppercase tracking-wide';
    case 'aguardandoRetorno':
      return 'chip border-dashed text-[var(--color-ink-soft)]';
    default:
      return 'chip';
  }
}

/** Classe da borda lateral / acento de um item conforme o estado. */
export function itemAccentClass(estado: ObligationEstado, critico?: boolean): string {
  if (estado === 'atrasada') return 'border-l-[3px] border-l-[var(--color-overdue)]';
  if (estado === 'concluida') return 'border-l-[3px] border-l-[var(--color-done)] opacity-70';
  if (critico) return 'border-l-[3px] border-l-[var(--color-serges-blue)]';
  return 'border-l-[3px] border-l-transparent';
}
