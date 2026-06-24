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
  mRealCusto?: Serie12;
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

/** Tem realizado lançado? (mês corrente ou série mensal). */
export function temRealizado(p: ProjResultado): boolean {
  return (p.receita ?? 0) !== 0 || (p.custo ?? 0) !== 0 || !!p.mRealReceita?.some((v) => v != null) || !!p.mRealCusto?.some((v) => v != null);
}

/** Projeto de "background": NÃO vira slide próprio, opera só no consolidado.
 * São as linhas de Ajuste de Orçamento, os futuros marcados manualmente e os
 * futuros só orçados (sem realizado, ex.: "Projetos futuros"). Um projeto futuro
 * que já roda (tem realizado) continua com slide; force "futuro: não" p/ exibir. */
export function ehBackground(p: ProjResultado): boolean {
  return !!p.ajuste || p.futuro === true || (ehFuturo(p) && !temRealizado(p));
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

/** Trio de séries mensais (12) de um indicador no slide consolidado. */
export interface TrioSerie {
  realizado: Serie12;
  orcado: Serie12;
  comFuturos: Serie12;
  comFuturosAjuste: Serie12;
}
export interface SeriesBU {
  receita: TrioSerie;
  resultado: TrioSerie;
}

/** Diferença mês a mês (receita − custo); null quando qualquer um está ausente. */
function difSerie(rec: Serie12, cus: Serie12): Serie12 {
  return rec.map((v, i) => (v == null || cus[i] == null ? null : v - cus[i]));
}

/**
 * Séries mensais (12) para os gráficos de linha do slide consolidado:
 * Receita e Resultado, cada um em Realizado / Orçado / Orçado + futuros.
 * Realizado usa as séries importadas (mês corrente como fallback). Futuros não
 * têm orçado: entram projetados pelo realizado, igual aos cenários escalares.
 */
export function seriesBU(c: Competencia): SeriesBU {
  const m = c.mes - 1;
  const inc = c.projetos.filter((p) => entraNoPeriodo(p, c.tipo) && !p.ajuste);
  const orcados = inc.filter((p) => !ehFuturo(p));
  const futuros = inc.filter((p) => ehFuturo(p));
  const ajuste = c.projetos.filter((p) => p.ajuste && !p.oculto);

  const realReceita = somaSeries(inc.map((p) => comMesCorrente(p.mRealReceita, m, p.receita)));
  const realCusto = somaSeries(inc.map((p) => comMesCorrente(p.mRealCusto, m, p.custo)));
  const orcReceita = somaSeries(orcados.map((p) => p.mOrcReceita));
  const orcCusto = somaSeries(orcados.map((p) => p.mOrcCusto));
  // Futuros que já rodam (têm realizado) entram pelo realizado; linhas de futuros
  // só orçadas (ex.: "Projetos futuros", sem realizado) entram pelo próprio orçado.
  const futReceita = somaSeries(futuros.map((p) => (temRealizado(p) ? comMesCorrente(p.mRealReceita, m, p.receita) : p.mOrcReceita)));
  const futCusto = somaSeries(futuros.map((p) => (temRealizado(p) ? comMesCorrente(p.mRealCusto, m, p.custo) : p.mOrcCusto)));
  const ajReceita = somaSeries(ajuste.map((p) => p.mOrcReceita));
  const ajCusto = somaSeries(ajuste.map((p) => p.mOrcCusto));
  const comFutReceita = somaSeries([orcReceita, futReceita]);
  const comFutCusto = somaSeries([orcCusto, futCusto]);
  const comFutAjReceita = somaSeries([comFutReceita, ajReceita]);
  const comFutAjCusto = somaSeries([comFutCusto, ajCusto]);

  return {
    receita: {
      realizado: realReceita,
      orcado: orcReceita,
      comFuturos: comFutReceita,
      comFuturosAjuste: comFutAjReceita,
    },
    resultado: {
      realizado: difSerie(realReceita, realCusto),
      orcado: difSerie(orcReceita, orcCusto),
      comFuturos: difSerie(comFutReceita, comFutCusto),
      comFuturosAjuste: difSerie(comFutAjReceita, comFutAjCusto),
    },
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

/** Acha o projeto equivalente por nome (igualdade normalizada; senão, contém). */
function projetoEquivalente(projetos: ProjResultado[], nomeNorm: string): ProjResultado | undefined {
  let p = projetos.find((x) => normalizar(x.nome) === nomeNorm);
  if (!p) p = projetos.find((x) => { const n = normalizar(x.nome); return n.length > 2 && (n.includes(nomeNorm) || nomeNorm.includes(n)); });
  return p;
}

/**
 * Preenche as séries de REALIZADO (mês a mês) da competência-alvo com os valores
 * das apresentações MENSAIS já curadas do mesmo ano (meses anteriores), para que os
 * gráficos em linha mostrem a evolução real (jan → mês atual). Derivação só para
 * exibição: NÃO persiste e não altera as apresentações de origem. O mês corrente é
 * preservado (vem do próprio realizado/importação da competência-alvo). */
export function mesclarHistorico(todas: Competencia[], alvo: Competencia): Competencia {
  const m = alvo.mes - 1;
  const fontes = todas.filter((k) => k.tipo === 'mensal' && k.ano === alvo.ano && k.id !== alvo.id && k.mes - 1 < m);
  if (!fontes.length) return alvo;
  const projetos = alvo.projetos.map((p) => {
    const nA = normalizar(p.nome);
    const rr = (p.mRealReceita ? [...p.mRealReceita] : serie12());
    const rc = (p.mRealCusto ? [...p.mRealCusto] : serie12());
    const rq = (p.mRealQtd ? [...p.mRealQtd] : serie12());
    while (rr.length < 12) rr.push(null);
    while (rc.length < 12) rc.push(null);
    while (rq.length < 12) rq.push(null);
    for (const k of fontes) {
      const idx = k.mes - 1;
      const q = projetoEquivalente(k.projetos, nA);
      if (!q) continue;
      rr[idx] = q.mRealReceita?.[idx] ?? (q.receita || null);
      rc[idx] = q.mRealCusto?.[idx] ?? (q.custo || null);
      rq[idx] = q.mRealQtd?.[idx] ?? (q.horas || null);
    }
    return { ...p, mRealReceita: rr, mRealCusto: rc, mRealQtd: rq };
  });
  return { ...alvo, projetos };
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
    asfsulnorteoeste: 'asfclinico',
  };
  const acha = (nome: string): number => {
    const n0 = normalizar(nome);
    const n = ALIAS[n0] ?? n0;
    let idx = orc.projetos.findIndex((o, i) => !usados.has(i) && !o.ajuste && normalizar(o.nome) === n);
    if (idx < 0) idx = orc.projetos.findIndex((o, i) => !usados.has(i) && !o.ajuste && (normalizar(o.nome).includes(n) || n.includes(normalizar(o.nome))));
    return idx;
  };
  // Soma mês a mês de várias linhas do orçamento (projetos agregados, ex.: New Life).
  const somarOrc = (linhas: OrcProjeto[]) => {
    const receita = Array(12).fill(0);
    const custo = Array(12).fill(0);
    const qtd = Array(12).fill(0);
    for (const o of linhas)
      for (let i = 0; i < 12; i++) {
        receita[i] += o.receita[i] ?? 0;
        custo[i] += o.custo[i] ?? 0;
        qtd[i] += o.qtd[i] ?? 0;
      }
    return { receita, custo, qtd };
  };

  const projetos = c.projetos.map((p) => {
    if (p.ajuste) return p;
    // New Life é UM projeto na apresentação (espelho de jan/fev): soma todas as
    // linhas "New Life" do orçamento (Maceió + Manaus) num card só.
    const nNorm = normalizar(p.nome);
    let indices: number[];
    if (nNorm.includes('newlife')) {
      indices = orc.projetos
        .map((o, i) => (!usados.has(i) && !o.ajuste && normalizar(o.nome).includes('newlife') ? i : -1))
        .filter((i) => i >= 0);
    } else {
      const i = acha(p.nome);
      indices = i >= 0 ? [i] : [];
    }
    if (!indices.length) return p; // sem orçamento → vira "futuro" automaticamente
    indices.forEach((i) => usados.add(i));
    const soma = somarOrc(indices.map((i) => orc.projetos[i]));
    // Linha de "Projetos futuros" do orçamento: é futuro (background, sem slide),
    // alimentando o consolidado. Garante isso mesmo em competências já existentes.
    const ehFutLinha = indices.some((i) => normalizar(orc.projetos[i].nome).includes('futuro'));
    return {
      ...p,
      futuro: ehFutLinha ? true : p.futuro,
      oculto: ehFutLinha ? false : p.oculto,
      receitaOrcado: Math.round(soma.receita[m] ?? 0),
      custoOrcado: Math.round(soma.custo[m] ?? 0),
      mOrcReceita: soma.receita.map((v) => Math.round(v)),
      mOrcCusto: soma.custo.map((v) => Math.round(v)),
      mOrcQtd: soma.qtd.map((v) => Math.round(v)),
    };
  });

  // Projetos do orçamento que não casaram com nenhum da apresentação.
  // - Linha de ajuste: visível, entra no cenário "Orçado + ajuste".
  // - Linha de "Projetos futuros": vira projeto FUTURO visível (sem slide próprio),
  //   alimentando o cenário "Orçado + futuros" do consolidado pelo seu orçado.
  // - Demais: ocultos (só aparecem quando ganharem dados/realizado).
  orc.projetos.forEach((o, i) => {
    if (usados.has(i)) return;
    const ehFut = !o.ajuste && normalizar(o.nome).includes('futuro');
    projetos.push({
      id: `pr-${crypto.randomUUID().slice(0, 8)}`,
      nome: o.nome,
      receita: 0,
      custo: 0,
      oculto: o.ajuste ? false : ehFut ? false : true,
      ajuste: o.ajuste,
      futuro: ehFut ? true : undefined,
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
  { nomeTest: (n) => n.includes('asf') && n.includes('pediatria'), pred: (c, g) => g.includes('pediatria') && c.includes('asf') },
  { nomeTest: (n) => n.includes('asf') && !n.includes('pediatria'), pred: (_c, g) => g.startsWith('asf') && !g.includes('pediatria') },
  { nomeTest: (n) => n.includes('newlife') || n.includes('maceio') || n.includes('manaus'), pred: (c) => c.includes('newlife') || c.includes('maceio') || c.includes('manaus') },
  { nomeTest: (n) => n.includes('sjp') || n.includes('saojosedospinhais') || n.includes('afonsopena'), pred: (c, g) => c.includes('saojosedospinhais') || c.includes('afonsopena') || c.includes('sjp') || g.includes('saojosedospinhais') },
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

/** Entidades tratadas como UM projeto só na apresentação (espelho de jan/fev):
 * as unidades New Life entram juntas e "Prefeitura de São José dos Pinhais" = SJP.
 * Aplicado ao auto-criar cards de contratos não casados (normaliza o nome). */
const CANON_PROJETO: Array<{ nome: string; test: (n: string) => boolean }> = [
  { nome: 'New Life (Maceió + Manaus)', test: (n) => n.includes('newlife') || n.includes('maceio') || n.includes('manaus') },
  { nome: 'SJP', test: (n) => n.includes('sjp') || n.includes('saojosedospinhais') || n.includes('afonsopena') },
];
function canonProjeto(nomeNorm: string): string | undefined {
  return CANON_PROJETO.find((g) => g.test(nomeNorm))?.nome;
}

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
  /** Projeto criado automaticamente nesta importação (card oculto). */
  autoCreado?: boolean;
}
export interface ResultadoImport {
  competencia: Competencia;
  resumo: LinhaResumoImport[];
  /** Projetos criados automaticamente como ocultos nesta importação. */
  criados: Array<{ nome: string; n: number; receita: number }>;
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
 * quando apurado=0. Todos os status entram. Furos permanecem manuais.
 * Contratos que não casam com nenhum projeto recebem um card oculto automaticamente. */
export function importarPlantoes(c: Competencia, linhas: PlantaoRow[]): ResultadoImport {
  const m = c.mes - 1;
  const agg = new Map<string, AggImport>(); // chave = id do projeto
  // Contratos não casados: agrupados por nome do contrato (raw).
  const semCasar = new Map<string, { n: number; receita: number; custo: number; horas: number }>();
  let totalCasados = 0;

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
      const nomeContrato = String(linha.contrato ?? '').trim() || '—';
      const u = semCasar.get(nomeContrato) ?? { n: 0, receita: 0, custo: 0, horas: 0 };
      u.n += 1;
      u.receita += receita;
      u.custo += custo;
      u.horas += horas;
      semCasar.set(nomeContrato, u);
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

  // Auto-criar projetos ocultos para contratos não casados.
  // Busca pelo nome normalizado: reutiliza card existente se já havia sido criado antes.
  const projetosBase = [...c.projetos];
  const criados: Array<{ nome: string; n: number; receita: number }> = [];
  const autoIds = new Set<string>();
  for (const [nomeContrato, u] of semCasar) {
    totalCasados += u.n;
    // Nome canônico (ex.: "Prefeitura de São José dos Pinhais" → "SJP"), p/ unificar
    // com o card/orçamento existente em vez de criar duplicata.
    const nome = canonProjeto(normalizar(nomeContrato)) ?? nomeContrato;
    const nN = normalizar(nome);
    const existing = projetosBase.find((p) => normalizar(p.nome) === nN);
    let id: string;
    if (existing) {
      id = existing.id;
    } else {
      const novoP: ProjResultado = { id: `pr-${crypto.randomUUID().slice(0, 8)}`, nome, receita: 0, custo: 0, oculto: true };
      projetosBase.push(novoP);
      id = novoP.id;
      criados.push({ nome, n: u.n, receita: u.receita });
    }
    autoIds.add(id);
    const a = agg.get(id) ?? { n: 0, receita: 0, custo: 0, horas: 0, consultas: 0 };
    a.n += u.n;
    a.receita += u.receita;
    a.custo += u.custo;
    a.horas += u.horas;
    agg.set(id, a);
  }

  const resumo: LinhaResumoImport[] = [];
  const projetos = projetosBase.map((p) => {
    const a = agg.get(p.id);
    if (!a) return p;
    const valorOp = p.perConsulta ? Math.round(a.consultas) : Math.round(a.horas);
    resumo.push({ nome: p.nome, n: a.n, receita: a.receita, custo: a.custo, horas: a.horas, consultas: a.consultas, perConsulta: !!p.perConsulta, autoCreado: autoIds.has(p.id) });
    return {
      ...p,
      receita: Math.round(a.receita),
      custo: Math.round(a.custo),
      horas: valorOp,
      unidade: (p.perConsulta ? 'consultas' : 'horas') as Unidade,
      mRealReceita: setSerie(p.mRealReceita, m, Math.round(a.receita)),
      mRealCusto: setSerie(p.mRealCusto, m, Math.round(a.custo)),
      mRealQtd: setSerie(p.mRealQtd, m, valorOp),
    };
  });

  return {
    competencia: { ...c, projetos },
    resumo,
    criados,
    totalPlantoes: linhas.length,
    totalCasados,
  };
}


const SEED_PROJETOS: Array<Pick<ProjResultado, 'nome' | 'perConsulta'>> = [
  { nome: 'ASF (Sul+Norte+Oeste)' },
  { nome: 'ASF Pediatria' },
  { nome: 'New Life (Maceió + Manaus)' },
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
