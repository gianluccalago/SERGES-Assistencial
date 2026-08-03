import type {
  CalendarItem,
  ManualObligation,
  Obligation,
  Override,
  Project,
  TarefaFixa,
} from './types';
import { deriveObligations, type DerivacaoOpcoes } from './engine';
import { competencia as fmtCompetencia, utcDate, toISODate, lastDayOfMonth } from './dateUtils';
import { ocorrenciasNoIntervalo, idOcorrencia, descreverRecorrencia } from './recorrencia';

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
  opcoes?: DerivacaoOpcoes,
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
    for (const o of deriveObligations(y, mm, projects, holidays, tarefasFixas, opcoes)) {
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

  // Manuais: data única, ou várias quando há recorrência. Cada ocorrência tem
  // id próprio (`id@data`) e guarda status/edições em `overrides`, igual às
  // geradas — por isso concluir uma data não mexe nas outras. A janela cobre os
  // meses vizinhos porque uma ocorrência movida pode entrar/sair do mês.
  const antesY = month === 1 ? year - 1 : year;
  const antesM = month === 1 ? 12 : month - 1;
  const depoisY = month === 12 ? year + 1 : year;
  const depoisM = month === 12 ? 1 : month + 1;
  const janelaDe = toISODate(utcDate(antesY, antesM, 1));
  const janelaAte = toISODate(utcDate(depoisY, depoisM, lastDayOfMonth(depoisY, depoisM)));

  for (const m of manuals) {
    if (!m.recorrencia) {
      if (m.data.startsWith(comp)) items.push(manualToItem(m));
      continue;
    }
    for (const data of ocorrenciasNoIntervalo(m, janelaDe, janelaAte, holidays)) {
      const id = idOcorrencia(m.id, data);
      const item = applyOverride(
        {
          id,
          titulo: m.titulo,
          projetoId: m.projetoId,
          tipo: m.tipo,
          regraOrigem: descreverRecorrencia(m.recorrencia),
          competencia: data.slice(0, 7),
          prazoCalculado: data,
          estado: 'pendente',
          responsavel: m.responsavel,
          critico: m.critico,
        },
        overrides[id],
      );
      if (!item) continue; // ocorrência ocultada
      item.notas = item.notas ?? m.notas;
      item.ocorrenciaDe = m.id;
      if (item.prazo?.startsWith(comp)) items.push(item);
    }
  }

  return items;
}

/** Itens sem prazo (aguardando retorno) de uma competência, para a lista lateral. */
export function isAguardando(item: CalendarItem): boolean {
  return !item.prazo && item.baseEstado === 'aguardandoInput';
}
