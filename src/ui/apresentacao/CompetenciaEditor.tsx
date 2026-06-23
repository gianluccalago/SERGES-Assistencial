import { useEffect, useState } from 'react';
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
  totais,
  cenariosOrcamento,
  temFuturos,
  temAjuste,
  variacao,
  novoProjeto,
  novoSlideTexto,
  rotuloPadrao,
  type CenarioOrc,
  type TipoPeriodo,
} from '../../apresentacao/model';

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
  const [imprimindo, setImprimindo] = useState(false);

  const c = competencia;
  const patch = (p: Partial<Competencia>) => ap.upsert({ ...c, ...p });
  const patchProjeto = (id: string, p: Partial<ProjResultado>) =>
    patch({ projetos: c.projetos.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  useEffect(() => {
    if (!imprimindo) return;
    const t = setTimeout(() => window.print(), 150);
    const done = () => setImprimindo(false);
    window.addEventListener('afterprint', done);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [imprimindo]);

  const slides = montarDeck(c);

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
          <button className="btn-secondary" onClick={() => setApresentando(true)}>▶ Apresentar</button>
          <button className="btn-secondary" onClick={() => setImprimindo(true)}>Imprimir / PDF</button>
        </div>
      </div>

      {c.tipo === 'parcial' && (
        <p className="text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
          Parcial: projetos “por consulta” (Academias, Camboriú) ficam de fora. O orçado mostrado é mensal cheio.
        </p>
      )}

      <div className="segmented w-fit">
        <button className="seg-btn" data-active={aba === 'projetos'} onClick={() => setAba('projetos')}>Projetos</button>
        <button className="seg-btn" data-active={aba === 'apresentacao'} onClick={() => setAba('apresentacao')}>Apresentação ({slides.length})</button>
      </div>

      {aba === 'projetos' && (
        <ProjetosEditor c={c} patch={patch} patchProjeto={patchProjeto} parseNum={parseNum} />
      )}

      {aba === 'apresentacao' && (
        <ApresentacaoTab c={c} patch={patch} slides={slides} />
      )}

      {apresentando && <Apresentador slides={slides} c={c} onClose={() => setApresentando(false)} />}
      {imprimindo && <PrintDeck slides={slides} c={c} />}
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
        return (
          <div key={p.id} className={`card p-[var(--spacing-12)] ${incl ? '' : 'opacity-60'}`} style={p.ajuste ? { borderLeft: '3px solid var(--color-ink-faint)' } : futuro ? { borderLeft: '3px solid var(--color-serges-blue)' } : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input min-w-[180px] flex-1 font-medium" value={p.nome} onChange={(e) => patchProjeto(p.id, { nome: e.target.value })} />
              {p.ajuste ? (
                <span className="chip">Ajuste de Orçamento</span>
              ) : futuro ? (
                <span className="chip" style={{ borderColor: 'var(--color-serges-blue)', color: 'var(--color-serges-blue)' }}>Projeto futuro</span>
              ) : null}
              <label className="flex items-center gap-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]" title="Fatura por consulta — fica fora do parcial">
                <input type="checkbox" checked={!!p.perConsulta} onChange={(e) => patchProjeto(p.id, { perConsulta: e.target.checked })} /> por consulta
              </label>
              <label className="flex items-center gap-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]" title="Linha de Ajuste de Orçamento (não é projeto real)">
                <input type="checkbox" checked={!!p.ajuste} onChange={(e) => patchProjeto(p.id, { ajuste: e.target.checked })} /> ajuste
              </label>
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
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[length:var(--text-caption)]">
              <span className="text-[var(--color-ink-soft)]">Resultado <strong style={{ color: 'var(--color-done)' }}>{fmtBRL(resultado(p.receita, p.custo))}</strong></span>
              <span className="text-[var(--color-ink-soft)]">Margem <strong>{fmtPct(margem(p.receita, p.custo))}</strong></span>
              <span className="text-[var(--color-ink-soft)]">Margem orç. <strong>{fmtPct(margem(p.receitaOrcado ?? 0, p.custoOrcado ?? 0))}</strong></span>
              <input className="input ml-auto min-w-[200px] flex-1 py-1" placeholder="Comentário (aparece no slide)" value={p.comentario ?? ''} onChange={(e) => patchProjeto(p.id, { comentario: e.target.value })} />
            </div>
          </div>
        );
      })}
      <button className="btn-secondary" onClick={add}>+ Adicionar projeto</button>
    </div>
  );
}

function Campo({ label, v, onChange, parseNum }: { label: string; v?: number; onChange: (n: number) => void; parseNum: (v: string) => number }) {
  return (
    <label className="block">
      <span className="label mb-0.5 block">{label}</span>
      <input className="input py-1" inputMode="decimal" defaultValue={v ?? ''} onBlur={(e) => onChange(parseNum(e.target.value))} placeholder="0" />
    </label>
  );
}

// ---------- Aba apresentação: deck + slides de texto ----------
type Slide =
  | { tipo: 'capa' }
  | { tipo: 'projeto'; p: ProjResultado }
  | { tipo: 'bu' }
  | { tipo: 'texto'; s: SlideTexto };

function montarDeck(c: Competencia): Slide[] {
  const out: Slide[] = [{ tipo: 'capa' }];
  for (const p of c.projetos.filter((x) => entraNoPeriodo(x, c.tipo))) out.push({ tipo: 'projeto', p });
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

  return (
    <div className="space-y-[var(--spacing-16)]">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[length:var(--text-label)]">
          <input type="checkbox" checked={c.mostrarBU !== false} onChange={(e) => patch({ mostrarBU: e.target.checked })} /> Incluir slide BU Total
        </label>
        <button className="btn-secondary ml-auto" onClick={addTexto}>+ Slide de texto</button>
      </div>

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
    <div className="apr-slide flex aspect-[16/9] flex-col rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-24)] shadow-[var(--shadow-rest)]">
      {sub && <div className="mb-2 text-[length:var(--text-caption)] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-serges-blue)' }}>{sub}</div>}
      {children}
    </div>
  );
}

function Comparacao({ atual, anterior, orcado, inverter }: { atual: number; anterior?: number; orcado?: number; inverter?: boolean }) {
  const va = variacao(atual, anterior);
  const vo = variacao(atual, orcado);
  const cor = (v?: number) => {
    if (v == null) return 'var(--color-ink-faint)';
    const bom = inverter ? v < 0 : v > 0;
    return bom ? 'var(--color-done)' : 'var(--color-overdue)';
  };
  const seta = (v?: number) => (v == null ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '–');
  return (
    <div className="flex gap-3 text-[length:var(--text-caption)]">
      {va != null && <span style={{ color: cor(va) }}>ant. {seta(va)} {fmtPct(Math.abs(va))}</span>}
      {vo != null && <span style={{ color: cor(vo) }}>orç. {seta(vo)} {fmtPct(Math.abs(vo))}</span>}
    </div>
  );
}

function CenarioRow({ nome, cen, destaque }: { nome: string; cen: CenarioOrc; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] py-1.5 last:border-0">
      <span className={destaque ? 'font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}>{nome}</span>
      <span className="flex items-center gap-3 text-[length:var(--text-caption)]">
        <span className="text-[var(--color-ink-soft)]">{fmtBRL(cen.receita)}</span>
        <span className="min-w-[90px] text-right font-medium">{fmtBRL(cen.resultado)}</span>
        <span className="min-w-[48px] text-right" style={{ color: 'var(--color-serges-blue)' }}>{fmtPct(cen.margem)}</span>
      </span>
    </div>
  );
}

function LinhaFin({ label, atual, anterior, orcado, inverter, forte }: { label: string; atual: number; anterior?: number; orcado?: number; inverter?: boolean; forte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] py-2 last:border-0">
      <span className={`text-[var(--color-ink)] ${forte ? 'font-semibold' : ''}`}>{label}</span>
      <div className="flex items-center gap-4">
        <Comparacao atual={atual} anterior={anterior} orcado={orcado} inverter={inverter} />
        <span className={`min-w-[120px] text-right ${forte ? 'text-[length:var(--text-subheading)] font-semibold' : 'font-medium'}`}>{fmtBRL(atual)}</span>
      </div>
    </div>
  );
}

function SlideView({ slide, c, onComentarioBU }: { slide: Slide; c: Competencia; onComentarioBU: (t: string) => void }) {
  if (slide.tipo === 'capa') {
    return (
      <SlideShell>
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-[length:var(--text-caption)] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-serges-blue)' }}>SERGES · B.U. Assistencial</div>
          <h1 className="mt-2 text-[length:var(--text-display,2rem)] text-3xl font-bold text-[var(--color-ink)]">{c.titulo || 'Apresentação de Resultados'}</h1>
          <div className="mt-2 text-[var(--color-ink-soft)]">{TIPO_LABEL[c.tipo]} · {MESES[c.mes - 1]} de {c.ano}</div>
          {c.tipo === 'parcial' && <div className="mt-1 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">Realizado parcial (dias 1–15). Orçamento exibido é mensal cheio.</div>}
        </div>
      </SlideShell>
    );
  }
  if (slide.tipo === 'projeto') {
    const p = slide.p;
    return (
      <SlideShell sub="Resultado por projeto">
        <h2 className="text-[length:var(--text-heading)] font-semibold">{p.nome}</h2>
        <div className="mt-3 flex-1">
          <LinhaFin label="Receita" atual={p.receita} anterior={p.receitaAnterior} orcado={p.receitaOrcado} />
          <LinhaFin label="Custo médico" atual={p.custo} anterior={p.custoAnterior} orcado={p.custoOrcado} inverter />
          <LinhaFin label="Resultado" atual={resultado(p.receita, p.custo)} anterior={p.receitaAnterior != null ? resultado(p.receitaAnterior, p.custoAnterior ?? 0) : undefined} orcado={p.receitaOrcado != null ? resultado(p.receitaOrcado, p.custoOrcado ?? 0) : undefined} forte />
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-[length:var(--text-label)] text-[var(--color-ink-soft)]">{p.comentario}</p>
          <div className="text-right">
            <div className="label">Margem</div>
            <div className="text-[length:var(--text-heading)] font-bold" style={{ color: 'var(--color-serges-blue)' }}>{fmtPct(margem(p.receita, p.custo))}</div>
          </div>
        </div>
      </SlideShell>
    );
  }
  if (slide.tipo === 'bu') {
    const t = totais(c);
    const cen = cenariosOrcamento(c);
    return (
      <SlideShell sub="Consolidado · BU Total">
        <h2 className="text-[length:var(--text-heading)] font-semibold">BU Assistencial — Total</h2>
        <div className="mt-3 grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="label mb-1 uppercase">Realizado</div>
            <LinhaFin label="Receita" atual={t.receita} anterior={t.receitaAnterior} />
            <LinhaFin label="Custo médico" atual={t.custo} anterior={t.custoAnterior} inverter />
            <LinhaFin label="Resultado" atual={t.resultado} anterior={resultado(t.receitaAnterior, t.custoAnterior)} forte />
            <div className="mt-1 text-right text-[length:var(--text-label)] text-[var(--color-ink-soft)]">Margem <strong style={{ color: 'var(--color-serges-blue)' }}>{fmtPct(t.margem)}</strong></div>
          </div>
          <div>
            <div className="label mb-1 flex items-center justify-between uppercase"><span>Orçado — cenários</span><span className="normal-case text-[var(--color-ink-faint)]">receita · resultado · margem</span></div>
            <CenarioRow nome="Só projetos orçados" cen={cen.projetos} />
            {temFuturos(c) && <CenarioRow nome="+ Projetos futuros" cen={cen.comFuturos} />}
            {temAjuste(c) && <CenarioRow nome="+ Futuros + Ajuste" cen={cen.comFuturosAjuste} destaque />}
            <p className="label mt-1">Projetos futuros entram pela projeção do realizado. Sem ajuste = linha “+ Projetos futuros”.</p>
          </div>
        </div>
        <input className="input mt-2 w-full py-1" placeholder="Comentário do consolidado" value={c.comentarioBU ?? ''} onChange={(e) => onComentarioBU(e.target.value)} />
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
  return <SlideView slide={slide} c={c} onComentarioBU={() => {}} />;
}

// ---------- Impressão (PDF) ----------
function PrintDeck({ slides, c }: { slides: Slide[]; c: Competencia }) {
  return (
    <div className="apr-print fixed inset-0 z-[90] overflow-auto bg-white">
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } body { background: #fff; } .apr-print { position: static; } .apr-print .apr-slide { break-after: page; box-shadow: none; } }`}</style>
      <div className="space-y-4 p-6">
        {slides.map((s, i) => (
          <SlideViewStatic key={i} slide={s} c={c} />
        ))}
      </div>
    </div>
  );
}
