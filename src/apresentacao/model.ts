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
  /** Override do status "futuro": undefined = automático (sem orçado); true/false força. */
  futuro?: boolean;
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
  /** Gráfico extra opcional (abaixo dos furos no slide operacional). */
  graficoCustom?: GraficoCustom;
  /** Segundo gráfico extra opcional (logo abaixo do primeiro). */
  graficoCustom2?: GraficoCustom;
}

export type Unidade = 'horas' | 'consultas';
export type Serie12 = Array<number | null>;

/** Gráfico extra, configurável e opcional, por projeto (ex.: custo médico médio/mês). */
export interface GraficoCustom {
  titulo: string;
  tipo: 'linha' | 'barras';
  formato: 'numero' | 'moeda';
  valores: Serie12;
}
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

/** Subtotal nomeado: soma financeira de um conjunto de projetos (ex.: FUNEAS). */
export interface Subtotal {
  id: string;
  nome: string;
  projetoIds: string[];
}

export interface Competencia {
  id: string;
  titulo: string;
  ano: number;
  mes: number; // 1-12
  tipo: TipoPeriodo;
  /** Liga/desliga o slide consolidado (BU Total). */
  mostrarBU?: boolean;
  /** No parcial, proporcionaliza o orçado (×15/30) para comparar de forma justa. */
  proporcionalizarParcial?: boolean;
  projetos: ProjResultado[];
  subtotais?: Subtotal[];
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

/** Fator aplicado ao orçado mensal cheio para comparação no parcial (×15/30). */
export function fatorOrcado(c: Competencia): number {
  return c.tipo === 'parcial' && c.proporcionalizarParcial ? 15 / 30 : 1;
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

/** Projeto futuro: na apresentação mas fora do orçamento. Override manual em p.futuro;
 * por padrão (automático), é "futuro" quando não há orçado. */
export function ehFuturo(p: ProjResultado): boolean {
  if (p.ajuste) return false;
  if (p.futuro !== undefined) return p.futuro;
  return (p.receitaOrcado ?? 0) === 0 && (p.custoOrcado ?? 0) === 0;
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

function somaSeries(arr: Array<Serie12 | undefined>): Serie12 {
  const out = serie12();
  for (let i = 0; i < 12; i++) {
    let any = false;
    let s = 0;
    for (const a of arr) {
      const v = a?.[i];
      if (v != null) {
        any = true;
        s += v;
      }
    }
    out[i] = any ? s : null;
  }
  return out;
}

/** Projeto sintético que representa a soma de um subtotal (ex.: FUNEAS). */
export function subtotalProjeto(c: Competencia, sub: Subtotal): ProjResultado {
  const ms = sub.projetoIds
    .map((id) => c.projetos.find((p) => p.id === id))
    .filter((p): p is ProjResultado => !!p && !p.oculto);
  const sum = (f: (p: ProjResultado) => number | undefined) => ms.reduce((a, p) => a + (f(p) ?? 0), 0);
  return {
    id: sub.id,
    nome: sub.nome,
    receita: sum((p) => p.receita),
    custo: sum((p) => p.custo),
    receitaAnterior: sum((p) => p.receitaAnterior),
    custoAnterior: sum((p) => p.custoAnterior),
    receitaOrcado: sum((p) => p.receitaOrcado),
    custoOrcado: sum((p) => p.custoOrcado),
    mOrcReceita: somaSeries(ms.map((p) => p.mOrcReceita)),
    mRealReceita: somaSeries(ms.map((p) => comMesCorrente(p.mRealReceita, c.mes - 1, p.receita))),
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
  // Apelidos para nomes que divergem entre apresentação e planilha.
  const ALIAS: Record<string, string> = {
    hrnpfuneas: 'hnrp',
    ubsmontealegre: 'montealegredoscampos',
    upaafonsopena: 'sjp',
    saojosedospinhais: 'sjp',
  };
  const acha = (nome: string): number => {
    const n0 = normalizar(nome);
    const n = ALIAS[n0] ?? n0;
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

// ---------- Importação da planilha de plantões (Relatório Bruto) ----------
// Um plantão por linha; agregamos por projeto e preenchemos o realizado do mês.

/** Linha bruta do relatório (apenas os campos que usamos). */
export interface PlantaoRow {
  contrato?: unknown;
  grupo?: unknown;
  status?: unknown;
  totalPlanejado?: unknown;
  totalApurado?: unknown;
  totalFaturamento?: unknown;
  totalPagamento?: unknown;
  qtdAtendimentos?: unknown;
}

function numImport(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  return 0;
}

/** Regra de classificação de um plantão para um projeto da apresentação.
 * `nomeTest` casa pelo nome do projeto (robusto a renome); `pred` filtra a linha
 * por contrato/grupo normalizados. ORDEM IMPORTA (Pediatria antes de ASF geral). */
interface RegraImport {
  nomeTest: (nomeNorm: string) => boolean;
  pred: (contratoNorm: string, grupoNorm: string) => boolean;
}
const REGRAS_IMPORT: RegraImport[] = [
  { nomeTest: (n) => n.includes('asf') && n.includes('pediatria'), pred: (_c, g) => g.includes('pediatria') },
  { nomeTest: (n) => n.includes('asf') && !n.includes('pediatria'), pred: (_c, g) => g.startsWith('asf') && !g.includes('pediatria') },
  { nomeTest: (n) => n.includes('newlife') || n.includes('maceio'), pred: (c) => c.includes('newlife') || c.includes('maceio') },
  { nomeTest: (n) => n.includes('dezemergencias') || n.includes('10emergencias'), pred: (c, g) => c.includes('dezemergencias') || g.includes('dezemergencias') },
  { nomeTest: (n) => n === 'hrl' || n.includes('regionaldolitoral'), pred: (c, g) => c.includes('regionaldolitoral') || g === 'hrl' },
  { nomeTest: (n) => n.includes('hrnp'), pred: (c, g) => c === 'hrnp' || g.includes('hrnp') },
  { nomeTest: (n) => n.includes('hzn'), pred: (c, g) => c === 'hzn' || g.includes('hzn') },
  { nomeTest: (n) => n.includes('ipiranga'), pred: (c, g) => c.includes('ipiranga') || g.includes('ipiranga') },
  { nomeTest: (n) => n.includes('arnaldo'), pred: (c) => c.includes('arnaldo') },
  { nomeTest: (n) => n.includes('montealegre'), pred: (c, g) => c.includes('montealegre') || g.includes('montealegre') },
  { nomeTest: (n) => n.includes('herval'), pred: (c, g) => c.includes('herval') || g.includes('herval') },
  { nomeTest: (n) => n.includes('palmas'), pred: (c, g) => c.includes('palmas') || g.includes('palmas') },
  { nomeTest: (n) => n.includes('mandirituba'), pred: (c, g) => c.includes('mandirituba') || g.includes('mandirituba') },
];

interface AggImport {
  n: number;
  receita: number;
  custo: number;
  horas: number;
  consultas: number;
}

export interface LinhaResumoImport {
  nome: string;
  n: number;
  receita: number;
  custo: number;
  horas: number;
  consultas: number;
  perConsulta: boolean;
}
export interface ResultadoImport {
  competencia: Competencia;
  resumo: LinhaResumoImport[];
  naoCasaram: Array<{ chave: string; n: number; receita: number }>;
  totalPlantoes: number;
  totalCasados: number;
}

/** Grava v na posição i da série (sobrescreve), garantindo 12 posições. */
function setSerie(arr: Serie12 | undefined, i: number, v: number): Serie12 {
  const a = arr ? [...arr] : serie12();
  while (a.length < 12) a.push(null);
  a[i] = v;
  return a;
}

/** Agrega os plantões e preenche o realizado (receita, custo, horas/consultas) do
 * mês da competência em cada projeto que casou com ≥1 linha. Projetos sem linha
 * ficam intactos (não zera dados manuais). Horas = apurado, com fallback p/ planejado
 * quando apurado=0. Todos os status entram. Furos permanecem manuais. */
export function importarPlantoes(c: Competencia, linhas: PlantaoRow[]): ResultadoImport {
  const m = c.mes - 1;
  // Agrega cada linha no primeiro projeto cujo nome casa com uma regra que aceita a linha.
  const agg = new Map<string, AggImport>(); // chave = id do projeto
  const naoCasaram = new Map<string, { n: number; receita: number }>();
  let totalCasados = 0;

  // Pré-resolve a regra de cada projeto (pela ordem de REGRAS_IMPORT).
  const regraDoProjeto = new Map<string, RegraImport>();
  for (const p of c.projetos) {
    if (p.ajuste) continue;
    const nn = normalizar(p.nome);
    const regra = REGRAS_IMPORT.find((r) => r.nomeTest(nn));
    if (regra) regraDoProjeto.set(p.id, regra);
  }

  for (const linha of linhas) {
    const cN = normalizar(String(linha.contrato ?? ''));
    const gN = normalizar(String(linha.grupo ?? ''));
    const apur = numImport(linha.totalApurado);
    const plan = numImport(linha.totalPlanejado);
    const horas = apur > 0 ? apur : plan;
    const receita = numImport(linha.totalFaturamento);
    const custo = numImport(linha.totalPagamento);
    const consultas = numImport(linha.qtdAtendimentos);

    let casou: string | null = null;
    for (const p of c.projetos) {
      const regra = regraDoProjeto.get(p.id);
      if (regra && regra.pred(cN, gN)) {
        casou = p.id;
        break;
      }
    }
    if (!casou) {
      const chave = `${String(linha.contrato ?? '—')} / ${String(linha.grupo ?? '—')}`;
      const u = naoCasaram.get(chave) ?? { n: 0, receita: 0 };
      u.n += 1;
      u.receita += receita;
      naoCasaram.set(chave, u);
      continue;
    }
    totalCasados += 1;
    const a = agg.get(casou) ?? { n: 0, receita: 0, custo: 0, horas: 0, consultas: 0 };
    a.n += 1;
    a.receita += receita;
    a.custo += custo;
    a.horas += horas;
    a.consultas += consultas;
    agg.set(casou, a);
  }

  const resumo: LinhaResumoImport[] = [];
  const projetos = c.projetos.map((p) => {
    const a = agg.get(p.id);
    if (!a) return p;
    const valorOp = p.perConsulta ? Math.round(a.consultas) : Math.round(a.horas);
    resumo.push({ nome: p.nome, n: a.n, receita: a.receita, custo: a.custo, horas: a.horas, consultas: a.consultas, perConsulta: !!p.perConsulta });
    return {
      ...p,
      receita: Math.round(a.receita),
      custo: Math.round(a.custo),
      horas: valorOp,
      unidade: (p.perConsulta ? 'consultas' : 'horas') as Unidade,
      mRealReceita: setSerie(p.mRealReceita, m, Math.round(a.receita)),
      mRealQtd: setSerie(p.mRealQtd, m, valorOp),
    };
  });

  return {
    competencia: { ...c, projetos },
    resumo,
    naoCasaram: Array.from(naoCasaram.entries()).map(([chave, v]) => ({ chave, n: v.n, receita: v.receita })),
    totalPlantoes: linhas.length,
    totalCasados,
  };
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
  const projetos = SEED_PROJETOS.map((s) => novoProjeto(s));
  // Subtotal FUNEAS = HRL + HZN + HRNP (mesma instituição).
  const funeasIds = projetos.filter((p) => /HRL|HZN|HRNP/.test(p.nome)).map((p) => p.id);
  const subtotais: Subtotal[] = funeasIds.length ? [{ id: `sub-${crypto.randomUUID().slice(0, 8)}`, nome: 'FUNEAS (HRL + HZN + HRNP)', projetoIds: funeasIds }] : [];
  return {
    id: `ap-${crypto.randomUUID().slice(0, 8)}`,
    titulo: '',
    ano: hoje.getFullYear(),
    mes: hoje.getMonth() + 1,
    tipo,
    mostrarBU: true,
    projetos,
    subtotais,
    slidesTexto: [],
    criadoEm: new Date().toISOString(),
    ...over,
  };
}

export function novoSubtotal(): Subtotal {
  return { id: `sub-${crypto.randomUUID().slice(0, 8)}`, nome: 'Novo subtotal', projetoIds: [] };
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
