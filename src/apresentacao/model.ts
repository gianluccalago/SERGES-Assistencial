// Módulo Apresentação de Resultados — modelo e lógica pura. Isolado: não importa
// nada dos outros módulos. Compara realizado × período anterior × orçado.

export type TipoPeriodo = 'parcial' | 'mensal';
export type TipoSlide = 'texto';

export interface ProjResultado {
  id: string;
  nome: string;
  /** Fatura por consulta realizada (Academias, Camboriú): fica fora do parcial. */
  perConsulta?: boolean;
  /** Oculta o projeto sem excluí-lo. */
  oculto?: boolean;
  receita: number;
  custo: number;
  receitaAnterior?: number;
  custoAnterior?: number;
  receitaOrcado?: number;
  custoOrcado?: number;
  horas?: number;
  comentario?: string;
  /** Linha "Ajuste de Orçamento" (não é projeto real; só entra no cenário com ajuste). */
  ajuste?: boolean;
  /** Unidade operacional: horas (plantões) ou consultas (por exame). */
  unidade?: Unidade;
  /** Furos / plantões descobertos no mês corrente (geralmente 0). */
  furos?: number;
  // Séries mensais do ano (12 posições, jan→dez) para os gráficos de tendência.
  mOrcReceita?: Serie12;
  mOrcCusto?: Serie12;
  mOrcQtd?: Serie12;
  mRealReceita?: Serie12;
  mRealQtd?: Serie12;
  mFuros?: Serie12;
}

export type Unidade = 'horas' | 'consultas';
export type Serie12 = Array<number | null>;
export function serie12(): Serie12 {
  return Array(12).fill(null);
}
/** Coloca o valor do mês corrente na série se aquela posição estiver vazia. */
export function comMesCorrente(arr: Serie12 | undefined, mesIdx: number, v: number | undefined): Serie12 {
  const a = arr ? [...arr] : serie12();
  if (a.length < 12) while (a.length < 12) a.push(null);
  if (a[mesIdx] == null && v != null) a[mesIdx] = v;
  return a;
}

/** Slide livre de texto (os slides de projeto e BU são derivados). */
export interface SlideTexto {
  id: string;
  tipo: TipoSlide;
  titulo: string;
  texto: string;
  /** posição: antes de qual? guardamos ordem simples por índice. */
}

export interface Competencia {
  id: string;
  titulo: string;
  ano: number;
  mes: number; // 1-12
  tipo: TipoPeriodo;
  /** Liga/desliga o slide consolidado (BU Total). */
  mostrarBU?: boolean;
  projetos: ProjResultado[];
  slidesTexto: SlideTexto[];
  comentarioBU?: string;
  criadoEm: string;
}

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const TIPO_LABEL: Record<TipoPeriodo, string> = { parcial: 'Parcial (1–15)', mensal: 'Mensal' };

export function fmtBRL(v?: number): string {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
export function fmtPct(v?: number): string {
  return v == null || !isFinite(v) ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function resultado(receita: number, custo: number): number {
  return receita - custo;
}
export function margem(receita: number, custo: number): number {
  return receita > 0 ? (receita - custo) / receita : 0;
}

/** Um projeto entra no período? Mensal: todos visíveis. Parcial: exclui perConsulta. */
export function entraNoPeriodo(p: ProjResultado, tipo: TipoPeriodo): boolean {
  if (p.oculto) return false;
  return tipo === 'mensal' ? true : !p.perConsulta;
}

/** Projeto futuro: está na apresentação mas ainda não consta no orçamento (sem orçado). */
export function ehFuturo(p: ProjResultado): boolean {
  return !p.ajuste && (p.receitaOrcado ?? 0) === 0 && (p.custoOrcado ?? 0) === 0;
}

export interface Totais {
  receita: number;
  custo: number;
  resultado: number;
  margem: number;
  receitaAnterior: number;
  custoAnterior: number;
}

/** Totais do REALIZADO (exclui a linha de Ajuste; inclui futuros, que são projetos reais). */
export function totais(c: Competencia): Totais {
  const inc = c.projetos.filter((p) => entraNoPeriodo(p, c.tipo) && !p.ajuste);
  const sum = (f: (p: ProjResultado) => number | undefined) => inc.reduce((acc, p) => acc + (f(p) ?? 0), 0);
  const receita = sum((p) => p.receita);
  const custo = sum((p) => p.custo);
  return {
    receita,
    custo,
    resultado: receita - custo,
    margem: margem(receita, custo),
    receitaAnterior: sum((p) => p.receitaAnterior),
    custoAnterior: sum((p) => p.custoAnterior),
  };
}

export interface CenarioOrc {
  receita: number;
  custo: number;
  resultado: number;
  margem: number;
}
function cenario(receita: number, custo: number): CenarioOrc {
  return { receita, custo, resultado: receita - custo, margem: margem(receita, custo) };
}

/**
 * Três cenários de orçamento para o slide do Total:
 * 1) só projetos orçados; 2) + projetos futuros (projeção pelo realizado);
 * 3) + futuros + linha de Ajuste de Orçamento.
 */
export function cenariosOrcamento(c: Competencia): { projetos: CenarioOrc; comFuturos: CenarioOrc; comFuturosAjuste: CenarioOrc } {
  const inc = c.projetos.filter((p) => entraNoPeriodo(p, c.tipo));
  const orcados = inc.filter((p) => !p.ajuste && !ehFuturo(p));
  const futuros = inc.filter((p) => !p.ajuste && ehFuturo(p));
  const ajuste = c.projetos.filter((p) => p.ajuste && !p.oculto);

  const rBase = orcados.reduce((a, p) => a + (p.receitaOrcado ?? 0), 0);
  const cBase = orcados.reduce((a, p) => a + (p.custoOrcado ?? 0), 0);
  // Futuros não têm orçado: projetamos pelo realizado.
  const rFut = futuros.reduce((a, p) => a + p.receita, 0);
  const cFut = futuros.reduce((a, p) => a + p.custo, 0);
  const rAj = ajuste.reduce((a, p) => a + (p.receitaOrcado ?? 0), 0);
  const cAj = ajuste.reduce((a, p) => a + (p.custoOrcado ?? 0), 0);

  return {
    projetos: cenario(rBase, cBase),
    comFuturos: cenario(rBase + rFut, cBase + cFut),
    comFuturosAjuste: cenario(rBase + rFut + rAj, cBase + cFut + cAj),
  };
}

/** Há linha de Ajuste de Orçamento na competência? */
export function temAjuste(c: Competencia): boolean {
  return c.projetos.some((p) => p.ajuste && !p.oculto);
}
/** Há projetos futuros (na apresentação, fora do orçamento)? */
export function temFuturos(c: Competencia): boolean {
  return c.projetos.some((p) => entraNoPeriodo(p, c.tipo) && !p.ajuste && ehFuturo(p));
}

// ---------- Orçamento anual (importado da planilha) ----------
export interface OrcProjeto {
  nome: string;
  receita: number[]; // 12
  custo: number[]; // 12
  qtd: number[]; // 12
  ajuste?: boolean;
}
export interface OrcamentoAno {
  ano: number;
  projetos: OrcProjeto[];
}

export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

/** Aplica o orçamento do ano à competência: preenche orçado (mês + séries),
 * adiciona como ocultos os projetos do orçamento ausentes, e cria a linha de ajuste. */
export function aplicarOrcamento(c: Competencia, orc: OrcamentoAno): Competencia {
  const m = c.mes - 1;
  const usados = new Set<number>();
  const acha = (nome: string): number => {
    const n = normalizar(nome);
    let idx = orc.projetos.findIndex((o, i) => !usados.has(i) && !o.ajuste && normalizar(o.nome) === n);
    if (idx < 0) idx = orc.projetos.findIndex((o, i) => !usados.has(i) && !o.ajuste && (normalizar(o.nome).includes(n) || n.includes(normalizar(o.nome))));
    return idx;
  };

  const projetos = c.projetos.map((p) => {
    if (p.ajuste) return p;
    const i = acha(p.nome);
    if (i < 0) return p; // sem orçamento → vira "futuro" automaticamente
    usados.add(i);
    const o = orc.projetos[i];
    return {
      ...p,
      receitaOrcado: Math.round(o.receita[m] ?? 0),
      custoOrcado: Math.round(o.custo[m] ?? 0),
      mOrcReceita: o.receita.map((v) => Math.round(v)),
      mOrcCusto: o.custo.map((v) => Math.round(v)),
      mOrcQtd: o.qtd.map((v) => Math.round(v)),
    };
  });

  // Projetos do orçamento que não casaram com nenhum da apresentação → ocultos.
  orc.projetos.forEach((o, i) => {
    if (usados.has(i)) return;
    projetos.push({
      id: `pr-${crypto.randomUUID().slice(0, 8)}`,
      nome: o.nome,
      receita: 0,
      custo: 0,
      oculto: !o.ajuste,
      ajuste: o.ajuste,
      receitaOrcado: Math.round(o.receita[m] ?? 0),
      custoOrcado: Math.round(o.custo[m] ?? 0),
      mOrcReceita: o.receita.map((v) => Math.round(v)),
      mOrcCusto: o.custo.map((v) => Math.round(v)),
      mOrcQtd: o.qtd.map((v) => Math.round(v)),
    });
  });

  return { ...c, projetos };
}

/** Variação percentual entre atual e base (anterior/orçado). */
export function variacao(atual: number, base?: number): number | undefined {
  if (base == null || base === 0) return undefined;
  return (atual - base) / Math.abs(base);
}

const SEED_PROJETOS: Array<Pick<ProjResultado, 'nome' | 'perConsulta'>> = [
  { nome: 'ASF (Sul+Norte+Oeste)' },
  { nome: 'ASF Pediatria' },
  { nome: 'New Life Maceió' },
  { nome: 'Dez Emergências Médicas' },
  { nome: 'HRL' },
  { nome: 'HRNP — FUNEAS' },
  { nome: 'HZN — FUNEAS' },
  { nome: 'Ipiranga/PR' },
  { nome: 'Hospital Dr. Arnaldo' },
  { nome: 'UBS Monte Alegre' },
  { nome: "UPA Herval d'Oeste" },
  { nome: 'UPA Palmas' },
  { nome: 'Mandirituba' },
  { nome: 'Academias', perConsulta: true },
  { nome: 'Camboriú', perConsulta: true },
];

function novoProjeto(over: Partial<ProjResultado> = {}): ProjResultado {
  return { id: `pr-${crypto.randomUUID().slice(0, 8)}`, nome: '', receita: 0, custo: 0, ...over };
}

export function novaCompetencia(tipo: TipoPeriodo, over: Partial<Competencia> = {}): Competencia {
  const hoje = new Date();
  return {
    id: `ap-${crypto.randomUUID().slice(0, 8)}`,
    titulo: '',
    ano: hoje.getFullYear(),
    mes: hoje.getMonth() + 1,
    tipo,
    mostrarBU: true,
    projetos: SEED_PROJETOS.map((s) => novoProjeto(s)),
    slidesTexto: [],
    criadoEm: new Date().toISOString(),
    ...over,
  };
}

/** Duplica uma competência (zera nada — serve de base para o próximo ciclo). */
export function duplicar(c: Competencia, tipo?: TipoPeriodo): Competencia {
  return {
    ...structuredClone(c),
    id: `ap-${crypto.randomUUID().slice(0, 8)}`,
    titulo: `${c.titulo || rotuloPadrao(c)} (cópia)`,
    tipo: tipo ?? c.tipo,
    criadoEm: new Date().toISOString(),
  };
}

export function novoSlideTexto(): SlideTexto {
  return { id: `st-${crypto.randomUUID().slice(0, 8)}`, tipo: 'texto', titulo: 'Novo slide', texto: '' };
}

export { novoProjeto };

export function rotuloPadrao(c: Competencia): string {
  return `${TIPO_LABEL[c.tipo]} · ${MESES[c.mes - 1]}/${String(c.ano).slice(2)}`;
}
