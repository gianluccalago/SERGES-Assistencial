import type { Obligation, Project, AjusteDiaUtil } from './types';
import {
  utcDate,
  toISODate,
  addCalendarDays,
  clampDayToMonth,
  lastDayOfMonth,
  competencia as fmtCompetencia,
} from './dateUtils';
import { isBusinessDay, previousBusinessDay, nextBusinessDay } from './holidays';

/**
 * Aplica a regra de dia útil a uma data:
 * - 'antecipa': prazos críticos internos (cards prontos, 0600, fechamento)
 *   recuam para o dia útil anterior. Nunca adiam.
 * - 'adia': datas de pagamento e datas genéricas seguem o próximo dia útil.
 * - 'nenhum': retorna a data como está.
 */
export function ajustarDiaUtil(date: Date, holidays: Set<string>, modo: AjusteDiaUtil): Date {
  if (modo === 'nenhum') return date;
  if (isBusinessDay(date, holidays)) return date;
  return modo === 'antecipa'
    ? previousBusinessDay(date, holidays)
    : nextBusinessDay(date, holidays);
}

/**
 * Data nominal de pagamento de um projeto no mês, sem ajuste.
 * O dia é limitado ao último dia do mês (ex.: dia 31 em fevereiro).
 */
export function paymentDateNominal(project: Project, year: number, month: number): Date {
  return utcDate(year, month, clampDayToMonth(year, month, project.diaPagamento));
}

/**
 * Data de pagamento ajustada: quando cai em dia não útil, segue o PRÓXIMO
 * dia útil (pagamento adia). Demonstra a direção oposta à antecipação do card.
 */
export function paymentDate(
  project: Project,
  year: number,
  month: number,
  holidays: Set<string>,
): Date {
  return ajustarDiaUtil(paymentDateNominal(project, year, month), holidays, 'adia');
}

/**
 * Prazo do card de pagamento de um projeto: cinco dias corridos antes do dia
 * nominal de pagamento (ou do dia-limite de lançamento, quando houver), e
 * antecipado para o dia útil anterior se cair em dia não útil. Prazo crítico.
 */
export function lotePagamentoPrazo(
  project: Project,
  year: number,
  month: number,
  holidays: Set<string>,
): Date {
  // Mandirituba e similares têm dia-limite de lançamento próprio.
  if (project.diaLancamento !== undefined) {
    const anchor = utcDate(year, month, clampDayToMonth(year, month, project.diaLancamento));
    return ajustarDiaUtil(anchor, holidays, 'antecipa');
  }
  const raw = addCalendarDays(paymentDateNominal(project, year, month), -5);
  return ajustarDiaUtil(raw, holidays, 'antecipa');
}

const DEP_EXIGE_RETORNO = new Set([
  'empenho',
  'ordemDeCompra',
  'validacaoContratante',
  'relatorioContratante',
  'escalista',
]);

interface FixedTask {
  chave: string;
  dia: number;
  titulo: string;
  modo: AjusteDiaUtil;
  critico?: boolean;
}

const FIXED_TASKS: FixedTask[] = [
  {
    chave: 'faturarFixos',
    dia: 1,
    titulo: 'Faturar valor fixo (Dez Emergências, Monte Alegre) e iniciar ciclo de cobrança',
    modo: 'adia',
  },
  {
    chave: 'documentacao',
    dia: 2,
    titulo: 'Produzir documentação dos projetos FUNEAS, HRL, HZN e HRNP',
    modo: 'adia',
  },
  {
    chave: 'fecharAcademia',
    dia: 3,
    titulo: 'Fechar a Academia e solicitar a nota fiscal do Fred',
    modo: 'adia',
  },
  {
    chave: 'iniciarAsf0600',
    dia: 16,
    titulo: 'Iniciar o faturamento da ASF e iniciar a 0600',
    modo: 'adia',
  },
  {
    chave: 'finalizar0600',
    dia: 24,
    titulo: 'Finalizar a 0600 (prazo crítico)',
    modo: 'antecipa',
    critico: true,
  },
  {
    chave: 'contratoSocialContabilidade',
    dia: 20,
    titulo: 'Alteração do contrato social — envio à contabilidade',
    modo: 'antecipa', // teto dia 20: antecipa em dia não útil, não adia.
    critico: true,
  },
];

/**
 * Deriva todas as obrigações de uma competência (ano/mês) a partir dos
 * projetos e dos feriados. Função pura: mesma entrada, mesma saída.
 * O estado retornado é o estado-base; a sobreposição do usuário e o cálculo
 * de "atrasada" ficam na máquina de estados.
 */
export function deriveObligations(
  year: number,
  month: number,
  projects: Project[],
  holidays: Set<string>,
): Obligation[] {
  const comp = fmtCompetencia(year, month);
  const out: Obligation[] = [];
  const ativos = projects.filter((p) => p.ativo);

  for (const p of ativos) {
    // --- Lote de pagamento (um por projeto/mês, contém os cards de médico) ---
    if (p.id === 'academia') {
      // Exceção: o card do Fred é lançado sempre no dia 1, regra própria.
      const dia1 = ajustarDiaUtil(utcDate(year, month, 1), holidays, 'antecipa');
      out.push({
        id: `lotePagamento:${p.id}:${comp}`,
        titulo: `Pagamentos do projeto ${p.nome} (Fred, dia 1)`,
        projetoId: p.id,
        tipo: 'lotePagamento',
        regraOrigem: 'Exceção Academia: card do Fred lançado no dia 1.',
        competencia: comp,
        prazoCalculado: toISODate(dia1),
        estado: 'pendente',
        responsavel: p.escalista,
        critico: true,
      });
    } else {
      const prazo = lotePagamentoPrazo(p, year, month, holidays);
      const base = p.diaLancamento !== undefined ? 'dia-limite de lançamento' : 'pagamento − 5 dias corridos';
      out.push({
        id: `lotePagamento:${p.id}:${comp}`,
        titulo: `Pagamentos do projeto ${p.nome}`,
        projetoId: p.id,
        tipo: 'lotePagamento',
        regraOrigem: `Prazo crítico: ${base}, antecipa em dia não útil.`,
        competencia: comp,
        prazoCalculado: toISODate(prazo),
        estado: 'pendente',
        responsavel: p.escalista,
        critico: true,
      });
    }

    // --- Faturamento: iniciar (cobrança), exceto valor fixo e Academia ---
    if (p.dependenciaFaturamento !== 'fixo' && p.id !== 'academia') {
      const dia = p.id === 'asf' ? 16 : 1;
      const prazo = ajustarDiaUtil(utcDate(year, month, dia), holidays, 'adia');
      out.push({
        id: `faturamentoIniciar:${p.id}:${comp}`,
        titulo: `Iniciar faturamento e cobrar contratante — ${p.nome}`,
        projetoId: p.id,
        tipo: 'faturamentoIniciar',
        regraOrigem: `Tarefa fixa de iniciar o processo, dia-âncora ${dia}.`,
        competencia: comp,
        prazoCalculado: toISODate(prazo),
        estado: 'pendente',
        responsavel: p.escalista,
      });
    }

    // --- Faturamento: card que aguarda retorno de terceiro ---
    if (DEP_EXIGE_RETORNO.has(p.dependenciaFaturamento)) {
      out.push({
        id: `faturamentoCard:${p.id}:${comp}`,
        titulo: `Card de faturamento — ${p.nome} (aguarda ${p.dependenciaFaturamento})`,
        projetoId: p.id,
        tipo: 'faturamentoCard',
        regraOrigem:
          'Sem data fixa: nasce aguardando retorno de terceiro; vira tarefa quando o retorno é registrado.',
        competencia: comp,
        estado: 'aguardandoInput',
        dependenciaAguardada: p.dependenciaFaturamento,
        responsavel: p.escalista,
      });
    }
  }

  // --- Tarefas fixas (não por projeto) ---
  for (const t of FIXED_TASKS) {
    const prazo = ajustarDiaUtil(utcDate(year, month, t.dia), holidays, t.modo);
    out.push({
      id: `fixa:${t.chave}:${comp}`,
      titulo: t.titulo,
      tipo: 'fixa',
      regraOrigem: `Dia-âncora ${t.dia}, regra de dia útil (${t.modo}).`,
      competencia: comp,
      prazoCalculado: toISODate(prazo),
      estado: 'pendente',
      critico: t.critico,
    });
  }

  // --- FOPAM de fechamento: último dia útil do mês ---
  {
    const last = utcDate(year, month, lastDayOfMonth(year, month));
    const prazo = previousBusinessDay(last, holidays);
    out.push({
      id: `fechamento:fopam:${comp}`,
      titulo: 'FOPAM de fechamento',
      tipo: 'fechamento',
      regraOrigem: 'Último dia útil do mês.',
      competencia: comp,
      prazoCalculado: toISODate(prazo),
      estado: 'pendente',
      critico: true,
    });
  }

  // --- Apresentações ---
  {
    const completa = nextBusinessDay(utcDate(year, month, 1), holidays);
    out.push({
      id: `apresentacao:completa:${comp}`,
      titulo: 'Apresentação — resultados completos (mês anterior, competência fechada)',
      tipo: 'apresentacao',
      regraOrigem: 'Primeiro dia útil do mês.',
      competencia: comp,
      prazoCalculado: toISODate(completa),
      estado: 'pendente',
    });

    const parcial = nextBusinessDay(utcDate(year, month, 16), holidays);
    out.push({
      id: `apresentacao:parcial:${comp}`,
      titulo: 'Apresentação — resultados parciais',
      tipo: 'apresentacao',
      regraOrigem: 'Primeiro dia útil após o dia 15.',
      competencia: comp,
      prazoCalculado: toISODate(parcial),
      estado: 'pendente',
    });
  }

  return out;
}
