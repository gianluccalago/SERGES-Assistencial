import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApresentacao } from '../../apresentacao/store';
import {
  type Competencia,
  type ProjResultado,
  type SlideTexto,
  MESES,
  TIPO_LABEL,
  fmtBRL,
  fmtPct,
  resultado,
  margem,
  entraNoPeriodo,
  ehFuturo,
  ehBackground,
  mesclarHistorico,
  seriesBU,
  temFuturos,
  temAjuste,
  novoProjeto,
  novoSlideTexto,
  rotuloPadrao,
  aplicarOrcamento,
  comMesCorrente,
  subtotalProjeto,
  novoSubtotal,
  fatorOrcado,
  importarPlantoes,
  type PlantaoRow,
  type ResultadoImport,
  type TipoPeriodo,
  type Unidade,
  type Subtotal,
  type GraficoCustom,
} from '../../apresentacao/model';

const MESES_CURTOS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function fmtGraf(formato: 'numero' | 'moeda'): (v: number) => string {
  if (formato === 'moeda') return (v) => (Math.abs(v) >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil` : `R$ ${Math.round(v).toLocaleString('pt-BR')}`);
  return (v) => Math.round(v).toLocaleString('pt-BR');
}
import { LineChart, BarChart, BarrasComparativas, type Serie } from './charts';
import { SergesLogo, SergesMark } from '../components/Logo';

const COR_ORC = '#94A3B8';
const COR_REAL = 'var(--color-serges-blue)';
const COR_FUT = '#0D9488';
const COR_AJ = '#D97706';
const COR_FUROS = 'var(--color-overdue)';

/** Eixo monetário compacto p/ os gráficos do consolidado (R$ X mil). */
const fmtMilhar = (v: number) => `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;

/** Texto padrão do campo de comentário (aparece no slide quando vazio). */
const SEM_COMENT = 'Sem comentários.';
const comentarioSlide = (s?: string) => (s && s.trim() ? s : SEM_COMENT);

function parseNum(v: string): number {
  const s = v.trim();
  if (!s) return 0;
  let n = s.replace(/[^\d.,-]/g, '');
  if (n.includes('.') && n.includes(',')) n = n.replace(/\./g, '').replace(',', '.');
  else if (n.includes(',')) n = n.replace(',', '.');
  const r = Number(n);
  return isFinite(r) ? r : 0;
}

export function CompetenciaEditor({ competencia, onVoltar }: { competencia: Competencia; onVoltar: () => void }) {
  const ap = useApresentacao();
  const [aba, setAba] = useState<'projetos' | 'apresentacao'>('projetos');
  const [apresentando, setApresentando] = useState(false);
  const [exportando, setExportando] = useState<null | 'pdf' | 'pptx'>(null);
  const [importando, setImportando] = useState(false);
  const [importResumo, setImportResumo] = useState<ResultadoImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const c = competencia;
  const patch = (p: Partial<Competencia>) => ap.upsert({ ...c, ...p });
  const patchProjeto = (id: string, p: Partial<ProjResultado>) =>
    patch({ projetos: c.projetos.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  // Visão dos slides: realizado mês a mês puxado das mensais já curadas do ano
  // (histórico p/ os gráficos em linha). Não persiste — edição segue em `c`.
  const cView = useMemo(() => mesclarHistorico(ap.state.competencias, competencia), [ap.state.competencias, competencia]);

  async function onArquivoPlantoes(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar o mesmo arquivo
    if (!file) return;
    setImportando(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const nomeAba = wb.SheetNames.find((n) => n.toLowerCase().includes('bruto')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[nomeAba];
      const linhas = XLSX.utils.sheet_to_json<PlantaoRow>(ws, { defval: null });
      if (!linhas.length) {
        alert('A planilha não tem linhas de plantão na aba "Relatório Bruto".');
        return;
      }
      const res = importarPlantoes(c, linhas);
      ap.upsert(res.competencia);
      setImportResumo(res);
    } catch (err) {
      console.error('[apresentacao] falha ao importar plantões', err);
      alert('Não consegui ler a planilha. Confira se é o arquivo .xlsx do relatório de plantões.');
    } finally {
      setImportando(false);
    }
  }

  const slides = montarDeck(cView);

  return (
    <div className="space-y-[var(--spacing-16)]">
      {/* Cabeçalho da competência */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={onVoltar}>← Voltar</button>
        <input
          className="input max-w-[320px] font-medium"
          placeholder={rotuloPadrao(c)}
          value={c.titulo}
          onChange={(e) => patch({ titulo: e.target.value })}
        />
        <div className="segmented">
          {(['parcial', 'mensal'] as TipoPeriodo[]).map((t) => (
            <button key={t} className="seg-btn" data-active={c.tipo === t} onClick={() => patch({ tipo: t })}>{TIPO_LABEL[t]}</button>
          ))}
        </div>
        <select className="select w-auto" value={c.mes} onChange={(e) => patch({ mes: Number(e.target.value) })}>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input className="input w-[90px]" type="number" value={c.ano} onChange={(e) => patch({ ano: Number(e.target.value) || c.ano })} />
        <div className="ml-auto flex gap-2">
          <button
            className="btn-secondary"
            title="Preenche o orçado de cada projeto a partir do orçamento anual importado"
            onClick={() => {
              const orc = ap.orcamentoDoAno(c.ano);
              if (!orc) {
                alert(`Orçamento de ${c.ano} ainda não importado. Rode o supabase/import_orcamento.sql.`);
                return;
              }
              ap.upsert(aplicarOrcamento(c, orc));
            }}
          >
            Puxar orçamento {c.ano}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onArquivoPlantoes} />
          <button
            className="btn-secondary"
            title="Importa o relatório de plantões (.xlsx) e preenche receita, custo médico e horas/consultas realizadas de cada projeto"
            disabled={importando}
            onClick={() => fileRef.current?.click()}
          >
            {importando ? 'Importando…' : 'Importar plantões (xlsx)'}
          </button>
          <button className="btn-secondary" onClick={() => setApresentando(true)}>▶ Apresentar</button>
          <button className="btn-secondary" disabled={!!exportando} onClick={() => setExportando('pdf')}>{exportando === 'pdf' ? 'Exportando…' : 'Exportar PDF'}</button>
          <button className="btn-secondary" disabled={!!exportando} onClick={() => setExportando('pptx')}>{exportando === 'pptx' ? 'Exportando…' : 'Exportar PPTX'}</button>
        </div>
      </div>

      {c.tipo === 'parcial' && (
        <div className="flex flex-wrap items-center gap-3 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
          <span>Parcial: projetos “por consulta” (Academias, Camboriú) ficam de fora.</span>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!c.proporcionalizarParcial} onChange={(e) => patch({ proporcionalizarParcial: e.target.checked })} />
            Proporcionalizar orçado (½ mês) para comparação justa
          </label>
        </div>
      )}

      <div className="segmented w-fit">
        <button className="seg-btn" data-active={aba === 'projetos'} onClick={() => setAba('projetos')}>Projetos</button>
        <button className="seg-btn" data-active={aba === 'apresentacao'} onClick={() => setAba('apresentacao')}>Apresentação ({slides.length})</button>
      </div>

      {aba === 'projetos' && (
        <ProjetosEditor c={c} patch={patch} patchProjeto={patchProjeto} parseNum={parseNum} />
      )}

      {aba === 'apresentacao' && (
        <ApresentacaoTab c={cView} patch={patch} slides={slides} />
      )}

      {apresentando && <Apresentador slides={slides} c={cView} onClose={() => setApresentando(false)} />}
      {exportando && <ExportDeck slides={slides} c={cView} formato={exportando} onDone={() => setExportando(null)} />}
      {importResumo && <ImportResumoModal res={importResumo} onClose={() => setImportResumo(null)} />}
    </div>
  );
}

// ---------- Editor de projetos ----------
function ProjetosEditor({
  c,
  patch,
  patchProjeto,
  parseNum,
}: {
  c: Competencia;
  patch: (p: Partial<Competencia>) => void;
  patchProjeto: (id: string, p: Partial<ProjResultado>) => void;
  parseNum: (v: string) => number;
}) {
  function add() {
    patch({ projetos: [...c.projetos, novoProjeto({ nome: 'Novo projeto' })] });
  }
  function remove(id: string) {
    patch({ projetos: c.projetos.filter((x) => x.id !== id) });
  }
  function mover(id: string, dir: -1 | 1) {
    const i = c.projetos.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= c.projetos.length) return;
    const arr = [...c.projetos];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    patch({ projetos: arr });
  }

  return (
    <div className="space-y-2">
      {c.projetos.map((p) => {
        const incl = entraNoPeriodo(p, c.tipo);
        const futuro = !p.ajuste && ehFuturo(p);
        const background = ehBackground(p);
        return (
          <div key={p.id} className={`card p-[var(--spacing-12)] ${incl ? '' : 'opacity-60'}`} style={p.ajuste ? { borderLeft: '3px solid var(--color-ink-faint)' } : futuro ? { borderLeft: '3px solid var(--color-serges-blue)' } : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input min-w-[180px] flex-1 font-medium" value={p.nome} onChange={(e) => patchProjeto(p.id, { nome: e.target.value })} />
              {p.ajuste ? (
                <span className="chip">Ajuste de Orçamento</span>
              ) : futuro ? (
                <span className="chip" style={{ borderColor: 'var(--color-serges-blue)', color: 'var(--color-serges-blue)' }}>Projeto futuro</span>
              ) : null}
              {background && (
                <span className="chip" title="Não gera slide próprio — entra só no slide consolidado (BU Total)">só no consolidado</span>
              )}
              <label className="flex items-center gap-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]" title="Fatura por consulta — fica fora do parcial">
                <input type="checkbox" checked={!!p.perConsulta} onChange={(e) => patchProjeto(p.id, { perConsulta: e.target.checked })} /> por consulta
              </label>
              <label className="flex items-center gap-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]" title="Linha de Ajuste de Orçamento (não é projeto real)">
                <input type="checkbox" checked={!!p.ajuste} onChange={(e) => patchProjeto(p.id, { ajuste: e.target.checked })} /> ajuste
              </label>
              {!p.ajuste && (
                <label className="flex items-center gap-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]" title="Projeto futuro (fora do orçamento). Automático = futuro quando não há orçado.">
                  futuro
                  <select
                    className="select w-auto py-0.5"
                    value={p.futuro === undefined ? 'auto' : p.futuro ? 'sim' : 'nao'}
                    onChange={(e) => patchProjeto(p.id, { futuro: e.target.value === 'auto' ? undefined : e.target.value === 'sim' })}
                  >
                    <option value="auto">auto</option>
                    <option value="sim">sim</option>
                    <option value="nao">não</option>
                  </select>
                </label>
              )}
              <button className="btn-ghost" onClick={() => patchProjeto(p.id, { oculto: !p.oculto })}>{p.oculto ? 'Mostrar' : 'Ocultar'}</button>
              <button className="btn-ghost" onClick={() => mover(p.id, -1)} title="Subir">↑</button>
              <button className="btn-ghost" onClick={() => mover(p.id, 1)} title="Descer">↓</button>
              <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => remove(p.id)}>×</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
              <Campo label="Receita" v={p.receita} onChange={(n) => patchProjeto(p.id, { receita: n })} parseNum={parseNum} />
              <Campo label="Custo médico" v={p.custo} onChange={(n) => patchProjeto(p.id, { custo: n })} parseNum={parseNum} />
              <Campo label="Receita ant." v={p.receitaAnterior} onChange={(n) => patchProjeto(p.id, { receitaAnterior: n })} parseNum={parseNum} />
              <Campo label="Custo ant." v={p.custoAnterior} onChange={(n) => patchProjeto(p.id, { custoAnterior: n })} parseNum={parseNum} />
              <Campo label="Receita orç." v={p.receitaOrcado} onChange={(n) => patchProjeto(p.id, { receitaOrcado: n })} parseNum={parseNum} />
              <Campo label="Custo orç." v={p.custoOrcado} onChange={(n) => patchProjeto(p.id, { custoOrcado: n })} parseNum={parseNum} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <label className="block">
                <span className="label mb-0.5 block">Unidade operacional</span>
                <select className="select py-1" value={p.unidade ?? 'horas'} onChange={(e) => patchProjeto(p.id, { unidade: e.target.value as Unidade })}>
                  <option value="horas">Horas (plantões)</option>
                  <option value="consultas">Consultas (por exame)</option>
                </select>
              </label>
              <Campo label={p.unidade === 'consultas' ? 'Consultas realiz.' : 'Horas realiz.'} v={p.horas} onChange={(n) => patchProjeto(p.id, { horas: n })} parseNum={parseNum} />
              <Campo label="Furos no mês" v={p.furos} onChange={(n) => patchProjeto(p.id, { furos: n })} parseNum={parseNum} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[length:var(--text-caption)]">
              <span className="text-[var(--color-ink-soft)]">Resultado <strong style={{ color: 'var(--color-serges-blue)' }}>{fmtBRL(resultado(p.receita, p.custo))}</strong></span>
              <span className="text-[var(--color-ink-soft)]">Margem <strong>{fmtPct(margem(p.receita, p.custo))}</strong></span>
              <span className="text-[var(--color-ink-soft)]">Margem orç. <strong>{fmtPct(margem(p.receitaOrcado ?? 0, p.custoOrcado ?? 0))}</strong></span>
              <CampoTexto className="ml-auto w-full min-w-[200px] flex-1" placeholder={SEM_COMENT} value={p.comentario ?? ''} onChange={(v) => patchProjeto(p.id, { comentario: v })} limite={220} />
            </div>
            {!p.ajuste && (
              <>
                <GraficoCustomEditor p={p} campo="graficoCustom" rotulo="Gráfico extra (abaixo dos furos)" patchProjeto={patchProjeto} parseNum={parseNum} />
                {p.graficoCustom && <GraficoCustomEditor p={p} campo="graficoCustom2" rotulo="2º gráfico extra (logo abaixo)" patchProjeto={patchProjeto} parseNum={parseNum} />}
              </>
            )}
          </div>
        );
      })}
      <button className="btn-secondary" onClick={add}>+ Adicionar projeto</button>
    </div>
  );
}

function Campo({ label, v, onChange, parseNum }: { label: string; v?: number; onChange: (n: number) => void; parseNum: (v: string) => number }) {
  // Controlado, mas resincroniza quando o valor externo muda (ex.: importação),
  // sem perder o que está sendo digitado. onBlur confirma o parse no estado.
  const [txt, setTxt] = useState(v == null ? '' : String(v));
  useEffect(() => {
    setTxt(v == null ? '' : String(v));
  }, [v]);
  return (
    <label className="block">
      <span className="label mb-0.5 block">{label}</span>
      <input
        className="input py-1"
        inputMode="decimal"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={(e) => onChange(parseNum(e.target.value))}
        placeholder="0"
      />
    </label>
  );
}

// Campo de comentário: cresce sozinho para mostrar o texto inteiro (sem barra de
// rolagem) e, quando `limite` é informado, mostra um contador que avisa quando o
// texto provavelmente passa do que cabe no slide.
function CampoTexto({ value, onChange, placeholder, className, limite }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; limite?: number }) {
  const [txt, setTxt] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setTxt(value); }, [value]);
  // Ajusta a altura ao conteúdo (auto-grow).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [txt]);
  const n = txt.trim().length;
  const excedeu = limite != null && n > limite;
  return (
    <div className={className}>
      <textarea
        ref={ref}
        className="input w-full resize-none py-1 leading-snug"
        rows={2}
        value={txt}
        placeholder={placeholder}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={(e) => onChange(e.target.value)}
        style={{ overflowY: 'auto' }}
      />
      {limite != null && (
        <div className={`mt-0.5 text-right text-[length:var(--text-caption)] ${excedeu ? 'text-[var(--color-overdue)]' : 'text-[var(--color-ink-faint)]'}`}>
          {n}/{limite}{excedeu ? ' · pode cortar no slide' : ''}
        </div>
      )}
    </div>
  );
}

function GraficoCustomEditor({ p, campo, rotulo, patchProjeto, parseNum }: { p: ProjResultado; campo: 'graficoCustom' | 'graficoCustom2'; rotulo: string; patchProjeto: (id: string, x: Partial<ProjResultado>) => void; parseNum: (v: string) => number }) {
  const g = p[campo];
  const set = (patch: Partial<GraficoCustom>) => g && patchProjeto(p.id, { [campo]: { ...g, ...patch } });
  return (
    <div className="mt-2 border-t border-[var(--color-line)] pt-2">
      <label className="flex items-center gap-2 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
        <input
          type="checkbox"
          checked={!!g}
          onChange={(e) => patchProjeto(p.id, { [campo]: e.target.checked ? { titulo: 'Custo médico médio/mês', tipo: 'linha', formato: 'moeda', valores: Array(12).fill(null) } : undefined })}
        />
        {rotulo}
      </label>
      {g && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input className="input min-w-[200px] flex-1 py-1" placeholder="Título do gráfico" value={g.titulo} onChange={(e) => set({ titulo: e.target.value })} />
            <select className="select w-auto py-1" value={g.tipo} onChange={(e) => set({ tipo: e.target.value as GraficoCustom['tipo'] })}>
              <option value="linha">Linha</option>
              <option value="barras">Barras</option>
            </select>
            <select className="select w-auto py-1" value={g.formato} onChange={(e) => set({ formato: e.target.value as GraficoCustom['formato'] })}>
              <option value="numero">Número</option>
              <option value="moeda">R$</option>
            </select>
          </div>
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
            {MESES_CURTOS.map((m, i) => (
              <label key={i} className="block text-center">
                <span className="label block">{m}</span>
                <input
                  className="input px-1 py-1 text-center"
                  inputMode="decimal"
                  defaultValue={g.valores[i] ?? ''}
                  onBlur={(e) => {
                    const v = [...g.valores];
                    v[i] = e.target.value.trim() === '' ? null : parseNum(e.target.value);
                    set({ valores: v });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Aba apresentação: deck + slides de texto ----------
type Slide =
  | { tipo: 'capa' }
  | { tipo: 'projOp'; p: ProjResultado }
  | { tipo: 'projFin'; p: ProjResultado }
  | { tipo: 'subtotal'; p: ProjResultado }
  | { tipo: 'bu' }
  | { tipo: 'texto'; s: SlideTexto };

function montarDeck(c: Competencia): Slide[] {
  const out: Slide[] = [{ tipo: 'capa' }];
  // Projetos futuros (só orçados) e linhas de ajuste NÃO viram slides: operam só no
  // background, alimentando o slide consolidado (BU Total). Aqui ficam os projetos reais.
  const visiveis = c.projetos.filter((x) => entraNoPeriodo(x, c.tipo) && !ehBackground(x));

  // Mapeia: índice do último projeto de cada subtotal → subtotais a inserir ali.
  const subtotalApos = new Map<number, Subtotal[]>();
  for (const sub of c.subtotais ?? []) {
    if (!sub.projetoIds.length) continue;
    let lastIdx = -1;
    for (let i = 0; i < visiveis.length; i++) {
      if (sub.projetoIds.includes(visiveis[i].id)) lastIdx = i;
    }
    if (lastIdx >= 0) {
      const arr = subtotalApos.get(lastIdx) ?? [];
      arr.push(sub);
      subtotalApos.set(lastIdx, arr);
    }
  }

  for (let i = 0; i < visiveis.length; i++) {
    const p = visiveis[i];
    out.push({ tipo: 'projOp', p });
    out.push({ tipo: 'projFin', p });
    for (const sub of subtotalApos.get(i) ?? []) {
      out.push({ tipo: 'subtotal', p: subtotalProjeto(c, sub) });
    }
  }

  if (c.mostrarBU !== false) out.push({ tipo: 'bu' });
  for (const s of c.slidesTexto) out.push({ tipo: 'texto', s });
  return out;
}

function ApresentacaoTab({ c, patch, slides }: { c: Competencia; patch: (p: Partial<Competencia>) => void; slides: Slide[] }) {
  function addTexto() {
    patch({ slidesTexto: [...c.slidesTexto, novoSlideTexto()] });
  }
  function patchTexto(id: string, p: Partial<SlideTexto>) {
    patch({ slidesTexto: c.slidesTexto.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  }
  function removeTexto(id: string) {
    patch({ slidesTexto: c.slidesTexto.filter((x) => x.id !== id) });
  }
  function moverTexto(id: string, dir: -1 | 1) {
    const i = c.slidesTexto.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= c.slidesTexto.length) return;
    const arr = [...c.slidesTexto];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    patch({ slidesTexto: arr });
  }

  const subtotais = c.subtotais ?? [];
  function addSubtotal() {
    patch({ subtotais: [...subtotais, novoSubtotal()] });
  }
  function patchSubtotal(id: string, p: Partial<Subtotal>) {
    patch({ subtotais: subtotais.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  }
  function removeSubtotal(id: string) {
    patch({ subtotais: subtotais.filter((x) => x.id !== id) });
  }

  return (
    <div className="space-y-[var(--spacing-16)]">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[length:var(--text-label)]">
          <input type="checkbox" checked={c.mostrarBU !== false} onChange={(e) => patch({ mostrarBU: e.target.checked })} /> Incluir slide BU Total
        </label>
        <button className="btn-secondary" onClick={addSubtotal}>+ Subtotal (instituição)</button>
        <button className="btn-secondary ml-auto" onClick={addTexto}>+ Slide de texto</button>
      </div>

      {/* Subtotais (somatórios por instituição, ex.: FUNEAS) */}
      {subtotais.length > 0 && (
        <div className="space-y-2">
          {subtotais.map((sub) => (
            <div key={sub.id} className="card p-[var(--spacing-12)]">
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-medium" value={sub.nome} onChange={(e) => patchSubtotal(sub.id, { nome: e.target.value })} />
                <span className="label">{sub.projetoIds.length} projeto(s)</span>
                <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => removeSubtotal(sub.id)}>×</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {c.projetos.filter((p) => !p.ajuste).map((p) => (
                  <label key={p.id} className="flex items-center gap-1 text-[length:var(--text-caption)]">
                    <input
                      type="checkbox"
                      checked={sub.projetoIds.includes(p.id)}
                      onChange={(e) =>
                        patchSubtotal(sub.id, {
                          projetoIds: e.target.checked ? [...sub.projetoIds, p.id] : sub.projetoIds.filter((x) => x !== p.id),
                        })
                      }
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editores dos slides de texto */}
      {c.slidesTexto.length > 0 && (
        <div className="space-y-2">
          {c.slidesTexto.map((s) => (
            <div key={s.id} className="card p-[var(--spacing-12)]">
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-medium" value={s.titulo} onChange={(e) => patchTexto(s.id, { titulo: e.target.value })} />
                <button className="btn-ghost" onClick={() => moverTexto(s.id, -1)}>↑</button>
                <button className="btn-ghost" onClick={() => moverTexto(s.id, 1)}>↓</button>
                <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => removeTexto(s.id)}>×</button>
              </div>
              <textarea className="input mt-2" rows={2} value={s.texto} onChange={(e) => patchTexto(s.id, { texto: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {/* Pré-visualização do deck */}
      <div className="space-y-4">
        {slides.map((s, i) => (
          <div key={i} className="mx-auto w-full max-w-[860px]">
            <SlideView slide={s} c={c} onComentarioBU={(t) => patch({ comentarioBU: t })} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Renderização dos slides ----------
function SlideShell({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="apr-slide relative flex aspect-[16/9] flex-col rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-24)] shadow-[var(--shadow-rest)]">
      {/* Marca SERGES no canto de cada slide */}
      <div className="absolute right-[var(--spacing-16)] top-[var(--spacing-16)] opacity-90">
        <SergesMark size={22} />
      </div>
      {sub && <div className="mb-2 pr-8 text-[length:var(--text-caption)] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-serges-blue)' }}>{sub}</div>}
      {children}
    </div>
  );
}

function SlideView({ slide, c, onComentarioBU, editavel = true }: { slide: Slide; c: Competencia; onComentarioBU: (t: string) => void; editavel?: boolean }) {
  if (slide.tipo === 'capa') {
    return (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-4"><SergesLogo /></div>
          <div className="text-[length:var(--text-caption)] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-serges-blue)' }}>B.U. Assistencial</div>
          <h1 className="mt-2 text-[length:var(--text-display,2rem)] text-3xl font-bold text-[var(--color-ink)]">{c.titulo || 'Apresentação de Resultados'}</h1>
          <div className="mt-2 text-[var(--color-ink-soft)]">{TIPO_LABEL[c.tipo]} · {MESES[c.mes - 1]} de {c.ano}</div>
          {c.tipo === 'parcial' && <div className="mt-1 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">Realizado parcial (dias 1–15). Orçamento exibido é mensal cheio.</div>}
        </div>
      </SlideShell>
    );
  }
  if (slide.tipo === 'projFin') return <FinanceiroSlide p={slide.p} c={c} sub="Resultado financeiro" />;
  if (slide.tipo === 'subtotal') return <FinanceiroSlide p={slide.p} c={c} sub="Subtotal — instituição" />;
  if (slide.tipo === 'projOp') {
    const p = slide.p;
    const unidadeLabel = p.unidade === 'consultas' ? 'Consultas' : 'Horas';
    const orcQtd = p.mOrcQtd && p.mOrcQtd.some((v) => v != null) ? p.mOrcQtd : undefined;
    const realQtd = comMesCorrente(p.mRealQtd, c.mes - 1, p.horas);
    const furos = comMesCorrente(p.mFuros, c.mes - 1, p.furos ?? 0);
    const fator = fatorOrcado(c);
    const realizadoMes = p.horas ?? 0;
    const orcadoMes = p.mOrcQtd?.[c.mes - 1] != null ? (p.mOrcQtd[c.mes - 1] as number) * fator : undefined;
    const fmtNum = (v: number) => Math.round(v).toLocaleString('pt-BR');
    const series: Serie[] = [];
    if (orcQtd) series.push({ nome: `${unidadeLabel} orçadas`, cor: COR_ORC, valores: orcQtd });
    series.push({ nome: `${unidadeLabel} realizadas`, cor: COR_REAL, valores: realQtd });
    return (
      <SlideShell sub="Operacional">
        <h2 className="text-[length:var(--text-heading)] font-semibold">{p.nome}</h2>
        {/* Comparação direta do mês: realizado × orçado */}
        <div className="mt-2 flex flex-wrap items-end gap-6">
          <div>
            <div className="label">{unidadeLabel} realizadas (mês)</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-serges-blue)' }}>{fmtNum(realizadoMes)}</div>
          </div>
          {orcadoMes != null && (
            <div>
              <div className="label">{unidadeLabel} orçadas</div>
              <div className="text-[length:var(--text-subheading)] font-semibold tabular-nums text-[var(--color-ink-soft)]">{fmtNum(orcadoMes)}</div>
            </div>
          )}
          {orcadoMes != null && orcadoMes > 0 && (
            <div className="ml-auto text-right">
              <div className="label">Atingido do orçado</div>
              <div className="text-[length:var(--text-subheading)] font-semibold" style={{ color: realizadoMes >= orcadoMes ? 'var(--color-serges-blue)' : 'var(--color-ink)' }}>{fmtPct(realizadoMes / orcadoMes)}</div>
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="min-w-0">
            <div className="label mb-1 uppercase">{unidadeLabel}: orçado × realizado (mês a mês)</div>
            <LineChart series={series} fmt={(v) => Math.round(v).toLocaleString('pt-BR')} altura={300} rotuloIdx={c.mes - 1} />
          </div>
          <div className="min-w-0">
            <div className="label mb-1 uppercase">Furos / descobertos</div>
            <BarChart valores={furos} cor={COR_FUROS} altura={200} />
            {[p.graficoCustom, p.graficoCustom2].map((gc, i) =>
              gc ? (
                <div key={i} className="mt-3">
                  <div className="label mb-1 uppercase">{gc.titulo}</div>
                  {gc.tipo === 'linha' ? (
                    <LineChart series={[{ nome: gc.titulo, cor: COR_REAL, valores: gc.valores }]} fmt={fmtGraf(gc.formato)} altura={200} />
                  ) : (
                    <BarChart valores={gc.valores} cor={COR_REAL} altura={200} />
                  )}
                </div>
              ) : null,
            )}
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[length:var(--text-subheading)] leading-snug text-[var(--color-ink)]">{comentarioSlide(p.comentario)}</p>
      </SlideShell>
    );
  }
  if (slide.tipo === 'bu') {
    const s = seriesBU(c);
    const comFut = temFuturos(c);
    const comAj = temAjuste(c);
    const serieReceita: Serie[] = [
      { nome: 'Realizado', cor: COR_REAL, valores: s.receita.realizado },
      { nome: 'Orçado', cor: COR_ORC, valores: s.receita.orcado },
    ];
    const serieResultado: Serie[] = [
      { nome: 'Realizado', cor: COR_REAL, valores: s.resultado.realizado },
      { nome: 'Orçado', cor: COR_ORC, valores: s.resultado.orcado },
    ];
    if (comFut) {
      serieReceita.push({ nome: 'Orçado + futuros', cor: COR_FUT, valores: s.receita.comFuturos });
      serieResultado.push({ nome: 'Orçado + futuros', cor: COR_FUT, valores: s.resultado.comFuturos });
    }
    if (comAj) {
      serieReceita.push({ nome: 'Orçado + ajuste', cor: COR_AJ, valores: s.receita.comFuturosAjuste });
      serieResultado.push({ nome: 'Orçado + ajuste', cor: COR_AJ, valores: s.resultado.comFuturosAjuste });
    }
    return (
      <SlideShell sub="Consolidado · BU Total">
        <h2 className="text-[length:var(--text-heading)] font-semibold">BU Assistencial — Total</h2>
        <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col">
            <div className="label mb-1 uppercase">Receita — mês a mês</div>
            <LineChart series={serieReceita} fmt={fmtMilhar} altura={300} rotuloIdx={c.mes - 1} />
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="label mb-1 uppercase">Resultado — mês a mês</div>
            <LineChart series={serieResultado} fmt={fmtMilhar} altura={300} rotuloIdx={c.mes - 1} />
          </div>
        </div>
        {editavel ? (
          <CampoTexto className="mt-2 w-full" placeholder={SEM_COMENT} value={c.comentarioBU ?? ''} onChange={onComentarioBU} limite={240} />
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-[length:var(--text-label)] leading-snug text-[var(--color-ink)]">{comentarioSlide(c.comentarioBU)}</p>
        )}
      </SlideShell>
    );
  }
  // texto
  return (
    <SlideShell sub="Observações">
      <h2 className="text-[length:var(--text-heading)] font-semibold">{slide.s.titulo}</h2>
      <p className="mt-3 flex-1 whitespace-pre-wrap text-[var(--color-ink)]">{slide.s.texto}</p>
    </SlideShell>
  );
}

// Slide financeiro reutilizado por projetos e por subtotais (ex.: FUNEAS).
// Barras agrupadas Orçado × Realizado à esquerda; números grandes + margem à direita.
function FinanceiroSlide({ p, c, sub }: { p: ProjResultado; c: Competencia; sub: string }) {
  const fator = fatorOrcado(c);
  const recOrc = (p.receitaOrcado ?? 0) * fator;
  const cusOrc = (p.custoOrcado ?? 0) * fator;
  const resReal = resultado(p.receita, p.custo);
  const resOrc = resultado(recOrc, cusOrc);
  const margemReal = margem(p.receita, p.custo);
  const margemOrc = margem(p.receitaOrcado ?? 0, p.custoOrcado ?? 0);
  const temOrcado = (p.receitaOrcado ?? 0) > 0 || (p.custoOrcado ?? 0) > 0;
  const milhar = (v: number) => `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;
  const parcialCheio = c.tipo === 'parcial' && !c.proporcionalizarParcial;

  return (
    <SlideShell sub={sub}>
      <h2 className="text-[length:var(--text-heading)] font-semibold">{p.nome}</h2>
      <div className="mt-3 grid flex-1 grid-cols-1 items-center gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Esquerda: barras agrupadas */}
        <div className="min-w-0">
          <BarrasComparativas
            grupos={[
              { label: 'Receita', orcado: recOrc, realizado: p.receita },
              { label: 'Custo médico', orcado: cusOrc, realizado: p.custo },
              { label: 'Resultado', orcado: resOrc, realizado: resReal, corReal: resReal < 0 ? 'var(--color-overdue)' : 'var(--color-serges-blue)' },
            ]}
            fmt={milhar}
            corOrcado={COR_ORC}
            corRealizado={COR_REAL}
          />
        </div>
        {/* Direita: três números grandes + margem */}
        <div className="flex flex-col gap-3">
          <NumeroGrande titulo="Receita" valor={p.receita} orcado={temOrcado ? recOrc : undefined} />
          <NumeroGrande titulo="Custo médico" valor={p.custo} orcado={temOrcado ? cusOrc : undefined} />
          <NumeroGrande titulo="Resultado" valor={resReal} orcado={temOrcado ? resOrc : undefined} cor={resReal < 0 ? 'var(--color-overdue)' : 'var(--color-serges-blue)'} />
          <div className="mt-1 flex items-end justify-between rounded-[var(--radius-md)] bg-[var(--color-serges-blue-tint)] px-4 py-2">
            <div>
              <div className="label">Margem realizada</div>
              <div className="text-3xl font-bold" style={{ color: 'var(--color-serges-blue)' }}>{fmtPct(margemReal)}</div>
            </div>
            {temOrcado && (
              <div className="text-right">
                <div className="label">Margem orçada</div>
                <div className="text-[length:var(--text-subheading)] font-semibold text-[var(--color-ink-soft)]">{fmtPct(margemOrc)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="whitespace-pre-wrap text-[length:var(--text-label)] leading-snug text-[var(--color-ink)]">{comentarioSlide(p.comentario)}</p>
        {parcialCheio && temOrcado && <span className="shrink-0 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">Realizado parcial (1–15) · orçado mensal cheio</span>}
        {c.tipo === 'parcial' && c.proporcionalizarParcial && <span className="shrink-0 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">Orçado proporcional (½ mês)</span>}
      </div>
    </SlideShell>
  );
}

function NumeroGrande({ titulo, valor, orcado, cor }: { titulo: string; valor: number; orcado?: number; cor?: string }) {
  return (
    <div>
      <div className="label">{titulo}</div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: cor ?? 'var(--color-ink)' }}>{fmtBRL(valor)}</div>
      {orcado != null && <div className="text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">Orçado {fmtBRL(orcado)}</div>}
    </div>
  );
}

// ---------- Modo apresentação (passos) ----------
function Apresentador({ slides, c, onClose }: { slides: Slide[]; c: Competencia; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [slides.length, onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/80 p-[4vh]" onClick={onClose}>
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1">
          <SlideViewStatic slide={slides[i]} c={c} />
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-white">
          <button className="btn-secondary" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>← Anterior</button>
          <span className="text-[length:var(--text-label)]">{i + 1} / {slides.length}</span>
          <button className="btn-secondary" onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))} disabled={i === slides.length - 1}>Próximo →</button>
          <button className="btn-ghost text-white" onClick={onClose}>Fechar (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// Versão estática (sem edição) para apresentar/imprimir.
function SlideViewStatic({ slide, c }: { slide: Slide; c: Competencia }) {
  return <SlideView slide={slide} c={c} onComentarioBU={() => {}} editavel={false} />;
}

// ---------- Resumo da importação de plantões ----------
function ImportResumoModal({ res, onClose }: { res: ResultadoImport; onClose: () => void }) {
  const totReceita = res.resumo.reduce((s, r) => s + r.receita, 0);
  const totCusto = res.resumo.reduce((s, r) => s + r.custo, 0);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-auto p-[var(--spacing-20)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h3 className="text-[length:var(--text-subheading)] font-semibold">Importação concluída</h3>
          <button className="btn-ghost ml-auto" onClick={onClose}>Fechar</button>
        </div>
        <p className="mt-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
          {res.totalCasados} de {res.totalPlantoes} plantões classificados. Receita e custo médico abaixo; margem é recalculada.
        </p>
        <div className="mt-3 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)]">
          <table className="w-full text-[length:var(--text-caption)]">
            <thead className="bg-[var(--color-canvas)] text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-2 py-1 text-left">Projeto</th>
                <th className="px-2 py-1 text-right">Plant.</th>
                <th className="px-2 py-1 text-right">Receita</th>
                <th className="px-2 py-1 text-right">Custo méd.</th>
                <th className="px-2 py-1 text-right">Horas/Cons.</th>
              </tr>
            </thead>
            <tbody>
              {res.resumo.map((r) => (
                <tr key={r.nome} className={`border-t border-[var(--color-line)] ${r.autoCreado ? 'opacity-60' : ''}`}>
                  <td className="px-2 py-1">
                    {r.nome}
                    {r.autoCreado && <span className="ml-1.5 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">(novo · oculto)</span>}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.n}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(r.receita)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(r.custo)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{Math.round(r.perConsulta ? r.consultas : r.horas).toLocaleString('pt-BR')}{r.perConsulta ? ' cons.' : ' h'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--color-line)] font-semibold">
                <td className="px-2 py-1">Total</td>
                <td className="px-2 py-1 text-right tabular-nums">{res.totalCasados}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(totReceita)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(totCusto)}</td>
                <td className="px-2 py-1" />
              </tr>
            </tbody>
          </table>
        </div>
        {res.criados.length > 0 && (
          <div className="mt-3">
            <div className="label mb-1" style={{ color: 'var(--color-serges-blue)' }}>Projetos criados automaticamente (ocultos)</div>
            <ul className="space-y-0.5 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
              {res.criados.map((x) => (
                <li key={x.nome}>• <strong>{x.nome}</strong> — {x.n} plantão(ões), {fmtBRL(x.receita)}</li>
              ))}
            </ul>
            <p className="mt-1 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">Aparecem na lista de projetos com o botão "Ocultar" ativado. Você pode torná-los visíveis a qualquer momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Exportação (PDF / PPTX) ----------
// Renderiza os slides num palco fixo de 1280×720 fora da tela, rasteriza cada um
// em PNG e monta o arquivo (1 slide = 1 página/slide, 16:9). O layout sai idêntico
// ao da apresentação — sem desconfigurar como acontecia na impressão do navegador.
function ExportDeck({ slides, c, formato, onDone }: { slides: Slide[]; c: Competencia; formato: 'pdf' | 'pptx'; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      try {
        // Deixa o layout estabilizar antes de capturar.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const nodes = Array.from(ref.current?.querySelectorAll('[data-slide]') ?? []) as HTMLElement[];
        if (!nodes.length) throw new Error('sem slides');
        const { rasterizarSlides, exportarPDF, exportarPPTX, nomeArquivo } = await import('./exportar');
        const imgs = await rasterizarSlides(nodes);
        if (cancel) return;
        const nome = nomeArquivo(c.titulo || rotuloPadrao(c));
        if (formato === 'pdf') await exportarPDF(imgs, nome);
        else await exportarPPTX(imgs, nome);
      } catch (e) {
        console.error('[apresentacao] falha ao exportar', e);
        alert('Não consegui gerar o arquivo. Tente novamente.');
      } finally {
        if (!cancel) onDone();
      }
    };
    void run();
    return () => {
      cancel = true;
    };
  }, []);

  return createPortal(
    <div ref={ref} className="export-stage" style={{ position: 'fixed', left: -100000, top: 0, width: 1280, background: '#fff', pointerEvents: 'none' }} aria-hidden>
      <style>{`.export-stage .apr-slide{box-shadow:none;border-radius:0;border:none;}`}</style>
      {slides.map((s, i) => (
        <div key={i} data-slide style={{ width: 1280 }}>
          <SlideViewStatic slide={s} c={c} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
