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
  /** Linha "Ajuste Orçamento": valor de receita somado ao orçado quando ligado. */
  ajusteReceita?: number;
  usarAjuste?: boolean;
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

export interface Totais {
  receita: number;
  custo: number;
  resultado: number;
  margem: number;
  receitaAnterior: number;
  custoAnterior: number;
  receitaOrcado: number;
  custoOrcado: number;
}

export function totais(c: Competencia): Totais {
  const inc = c.projetos.filter((p) => entraNoPeriodo(p, c.tipo));
  const sum = (f: (p: ProjResultado) => number | undefined) => inc.reduce((acc, p) => acc + (f(p) ?? 0), 0);
  const receita = sum((p) => p.receita);
  const custo = sum((p) => p.custo);
  const ajuste = c.usarAjuste ? c.ajusteReceita ?? 0 : 0;
  return {
    receita,
    custo,
    resultado: receita - custo,
    margem: margem(receita, custo),
    receitaAnterior: sum((p) => p.receitaAnterior),
    custoAnterior: sum((p) => p.custoAnterior),
    receitaOrcado: sum((p) => p.receitaOrcado) + ajuste,
    custoOrcado: sum((p) => p.custoOrcado),
  };
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
    usarAjuste: false,
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
