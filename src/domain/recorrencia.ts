// Expansão de tarefas recorrentes. A obrigação guarda a data-base e a regra;
// as ocorrências são calculadas sob demanda, nunca gravadas uma a uma — então
// mudar a regra reescreve todo o futuro e nada fica órfão no banco.

import type { ManualObligation, Recorrencia } from './types';
import {
  utcDate,
  toISODate,
  fromISODate,
  addCalendarDays,
  clampDayToMonth,
} from './dateUtils';
import { ajustarDiaUtil } from './engine';

/** Trava de segurança: nenhuma janela de consulta precisa de mais que isso. */
const MAX_OCORRENCIAS = 500;

const DIA_MS = 86_400_000;

const DOW_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/**
 * Datas (ISO) em que a tarefa acontece dentro do intervalo [deISO, ateISO].
 * Sem recorrência, devolve a própria data quando cai no intervalo.
 */
export function ocorrenciasNoIntervalo(
  m: ManualObligation,
  deISO: string,
  ateISO: string,
  holidays: Set<string>,
): string[] {
  const r = m.recorrencia;
  if (!r) return m.data >= deISO && m.data <= ateISO ? [m.data] : [];

  const base = fromISODate(m.data);
  const de = fromISODate(deISO);
  const ate = fromISODate(ateISO);

  const intervalo = Math.max(1, Math.floor(r.intervalo || 1));
  const fimSerie = r.ate ? fromISODate(r.ate) : null;
  // Limite efetivo: o que vier primeiro entre o fim da série e o fim da janela.
  const limite = fimSerie && fimSerie < ate ? fimSerie : ate;
  if (limite < base) return [];

  const brutas: Date[] = [];
  const add = (d: Date) => {
    if (d >= base && d <= limite) brutas.push(d);
  };

  if (r.frequencia === 'diaria' || (r.frequencia === 'semanal' && !r.diasSemana?.length)) {
    // Passo fixo em dias: pula direto para perto da janela, sem varrer desde a base.
    const passo = r.frequencia === 'diaria' ? intervalo : intervalo * 7;
    const desde = Math.floor((de.getTime() - base.getTime()) / DIA_MS);
    const k = desde > 0 ? Math.floor(desde / passo) : 0;
    for (let i = 0; i < MAX_OCORRENCIAS; i++) {
      const d = addCalendarDays(base, (k + i) * passo);
      if (d > limite) break;
      add(d);
    }
  } else if (r.frequencia === 'semanal') {
    // Dias da semana escolhidos, a cada N semanas contadas da semana da base.
    const dows = [...new Set(r.diasSemana ?? [])].sort((a, b) => a - b);
    const semanaBase = addCalendarDays(base, -base.getUTCDay());
    const semanasDesde = Math.floor((de.getTime() - semanaBase.getTime()) / (7 * DIA_MS));
    const k = semanasDesde > 0 ? Math.floor(semanasDesde / intervalo) : 0;
    for (let i = 0; i < MAX_OCORRENCIAS; i++) {
      const semana = addCalendarDays(semanaBase, (k + i) * intervalo * 7);
      if (semana > limite) break;
      for (const dow of dows) add(addCalendarDays(semana, dow));
    }
  } else {
    // Mensal/anual: mesmo dia do mês, limitado ao tamanho do mês (31 → 28/30).
    const passoMeses = r.frequencia === 'mensal' ? intervalo : intervalo * 12;
    const dia = base.getUTCDate();
    const idxBase = base.getUTCFullYear() * 12 + base.getUTCMonth();
    const idxDe = de.getUTCFullYear() * 12 + de.getUTCMonth();
    const k = idxDe > idxBase ? Math.floor((idxDe - idxBase) / passoMeses) : 0;
    for (let i = 0; i < MAX_OCORRENCIAS; i++) {
      const idx = idxBase + (k + i) * passoMeses;
      const y = Math.floor(idx / 12);
      const mo = (idx % 12) + 1;
      const d = utcDate(y, mo, clampDayToMonth(y, mo, dia));
      if (d > limite) break;
      add(d);
    }
  }

  // Aplica a regra de dia útil por ocorrência e devolve datas únicas na janela.
  const iso = brutas.map((d) => toISODate(r.modo ? ajustarDiaUtil(d, holidays, r.modo) : d));
  return [...new Set(iso)].filter((s) => s >= deISO && s <= ateISO).sort();
}

/** Id estável de uma ocorrência: id da tarefa + a data dela. */
export function idOcorrencia(manualId: string, dataISO: string): string {
  return `${manualId}@${dataISO}`;
}

/** Texto curto da regra, para o slot "regra de origem" e para a tela. */
export function descreverRecorrencia(r: Recorrencia): string {
  const n = Math.max(1, Math.floor(r.intervalo || 1));
  let base: string;
  if (r.frequencia === 'diaria') base = n === 1 ? 'Todo dia' : `A cada ${n} dias`;
  else if (r.frequencia === 'semanal') {
    const dias = [...new Set(r.diasSemana ?? [])].sort((a, b) => a - b).map((d) => DOW_NOME[d]);
    const quando = dias.length ? ` (${dias.join(', ')})` : '';
    base = (n === 1 ? 'Toda semana' : `A cada ${n} semanas`) + quando;
  } else if (r.frequencia === 'mensal') base = n === 1 ? 'Todo mês' : `A cada ${n} meses`;
  else base = n === 1 ? 'Todo ano' : `A cada ${n} anos`;

  const regra =
    r.modo === 'antecipa'
      ? ', antecipando em dia não útil'
      : r.modo === 'adia'
        ? ', adiando para o próximo dia útil'
        : '';
  const ate = r.ate ? ` até ${r.ate.split('-').reverse().join('/')}` : '';
  return `${base}${ate}${regra}.`;
}
