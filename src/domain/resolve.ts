import type {
  CalendarItem,
  ManualObligation,
  Obligation,
  Override,
  Project,
  TarefaFixa,
} from './types';
import { deriveObligations } from './engine';
import { competencia as fmtCompetencia } from './dateUtils';

/** Converte uma Obligation derivada + seu Override em CalendarItem (ou null se dismissed). */
export function applyOverride(obligation: Obligation, override?: Override): CalendarItem | null {
  if (override?.dismissed) return null;
  const prazo = override?.dataNova ?? obligation.prazoCalculado;
  return {
    id: obligation.id,
    titulo: override?.titulo ?? obligation.titulo,
    tipo: obligation.tipo,
    projetoId: override?.projetoId ?? obligation.projetoId,
    responsavel: override?.responsavel ?? obligation.responsavel,
    regraOrigem: obligation.regraOrigem,
    competencia: obligation.competencia,
    prazo,
    dependenciaAguardada: obligation.dependenciaAguardada,
    critico: obligation.critico,
    baseEstado: override?.estado ?? obligation.estado,
    notas: override?.notas,
    anexoPresente: override?.anexoPresente,
    enviadaAprovacaoEm: override?.enviadaAprovacaoEm,
    aspaConfirmado: override?.aspaConfirmado,
    pixConferido: override?.pixConferido,
    ocRecebida: override?.ocRecebida,
    escalado: override?.escaladoEm != null,
    cobrancasCount: override?.cobrancas?.length ?? 0,
    resolucaoMes: override?.resolucaoMes,
    recuperacao: override?.recuperacao,
    contratoSocial: override?.contratoSocial,
    isManual: false,
    movida: override?.dataNova != null,
  };
}

/** Promove uma ManualObligation a CalendarItem. */
export function manualToItem(m: ManualObligation): CalendarItem {
  return {
    id: m.id,
    titulo: m.titulo,
    tipo: m.tipo,
    projetoId: m.projetoId,
    responsavel: m.responsavel,
    regraOrigem: 'Obrigação criada manualmente pelo usuário.',
    competencia: m.data.slice(0, 7),
    prazo: m.data,
    critico: m.critico,
    baseEstado: m.estado,
    notas: m.notas,
    anexoPresente: m.anexoPresente,
    enviadaAprovacaoEm: m.enviadaAprovacaoEm,
    escalado: m.escaladoEm != null,
    cobrancasCount: m.cobrancas?.length ?? 0,
    isManual: true,
  };
}

/**
 * Monta a lista de obrigações de uma competência (ano/mês):
 * 1. deriva pelas regras;
 * 2. aplica os overrides (data nova vence a derivada; dismissed esconde);
 * 3. inclui as obrigações manuais cujo prazo cai no mês.
 *
 * Uma obrigação movida por override pode sair do mês de origem e entrar em
 * outro; por isso varremos overrides de meses vizinhos também.
 */
export function assembleMonth(
  year: number,
  month: number,
  projects: Project[],
  holidays: Set<string>,
  overrides: Record<string, Override>,
  manuals: ManualObligation[],
  tarefasFixas?: TarefaFixa[],
): CalendarItem[] {
  const comp = fmtCompetencia(year, month);
  const items: CalendarItem[] = [];

  // Deriva o mês corrente e os vizinhos, para capturar obrigações movidas
  // de/para fora do mês via override.dataNova.
  const derivedById = new Map<string, Obligation>();
  for (const m of [month - 1, month, month + 1]) {
    let y = year;
    let mm = m;
    if (mm < 1) {
      mm = 12;
      y -= 1;
    } else if (mm > 12) {
      mm = 1;
      y += 1;
    }
    for (const o of deriveObligations(y, mm, projects, holidays, tarefasFixas)) {
      derivedById.set(o.id, o);
    }
  }

  for (const o of derivedById.values()) {
    const item = applyOverride(o, overrides[o.id]);
    if (!item) continue;
    if (item.prazo?.startsWith(comp)) items.push(item);
    // Sem prazo (aguardando retorno) só aparece no seu mês de origem.
    else if (!item.prazo && o.competencia === comp) items.push(item);
  }

  for (const m of manuals) {
    if (m.data.startsWith(comp)) items.push(manualToItem(m));
  }

  return items;
}

/** Itens sem prazo (aguardando retorno) de uma competência, para a lista lateral. */
export function isAguardando(item: CalendarItem): boolean {
  return !item.prazo && item.baseEstado === 'aguardandoInput';
}
