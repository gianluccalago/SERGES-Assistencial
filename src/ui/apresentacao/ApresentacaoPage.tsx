import { useState, type CSSProperties } from 'react';
import { useApresentacao } from '../../apresentacao/store';
import { novaCompetencia, duplicar, rotuloPadrao, totais, fmtBRL, fmtPct, TIPO_LABEL, type Competencia, type TipoPeriodo } from '../../apresentacao/model';
import { CompetenciaEditor } from './CompetenciaEditor';

// Identidade visual própria do módulo: acento azul-petróleo (teal), sobrescrevendo
// as variáveis de marca apenas dentro deste container.
const TEMA: CSSProperties = {
  ['--color-serges-blue' as string]: '#0F766E',
  ['--color-serges-blue-strong' as string]: '#0B5E57',
  ['--color-serges-blue-tint' as string]: '#E6F2F1',
  ['--color-serges-blue-tint-soft' as string]: '#F2F8F7',
} as CSSProperties;

export function ApresentacaoPage() {
  const ap = useApresentacao();
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const aberta = abertaId ? ap.state.competencias.find((c) => c.id === abertaId) : null;

  function criar(tipo: TipoPeriodo) {
    const c = novaCompetencia(tipo);
    ap.upsert(c);
    setAbertaId(c.id);
  }

  return (
    <div style={TEMA} className="space-y-[var(--spacing-20)]">
      {aberta ? (
        <CompetenciaEditor competencia={aberta} onVoltar={() => setAbertaId(null)} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
              Apresentações de resultados para a diretoria. Compare realizado × período anterior × orçado.
            </p>
            <div className="ml-auto flex gap-2">
              <button className="btn-secondary" onClick={() => criar('parcial')}>+ Nova Parcial (1–15)</button>
              <button className="btn-primary" onClick={() => criar('mensal')}>+ Nova Mensal</button>
            </div>
          </div>

          {ap.state.competencias.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-ink-soft)]">
              Nenhuma apresentação ainda. Crie uma Parcial ou Mensal para começar.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ap.state.competencias.map((c) => (
                <CardCompetencia key={c.id} c={c} onAbrir={() => setAbertaId(c.id)} onDuplicar={() => ap.upsert(duplicar(c))} onExcluir={() => confirm('Excluir esta apresentação?') && ap.remove(c.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CardCompetencia({ c, onAbrir, onDuplicar, onExcluir }: { c: Competencia; onAbrir: () => void; onDuplicar: () => void; onExcluir: () => void }) {
  const t = totais(c);
  return (
    <div className="card flex flex-col gap-2 p-[var(--spacing-16)]">
      <button className="text-left" onClick={onAbrir}>
        <div className="font-semibold text-[var(--color-ink)] hover:underline">{c.titulo || rotuloPadrao(c)}</div>
        <div className="mt-0.5 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">{TIPO_LABEL[c.tipo]}</div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[length:var(--text-caption)]">
          <span className="text-[var(--color-ink-soft)]">Receita</span><span className="text-right font-medium">{fmtBRL(t.receita)}</span>
          <span className="text-[var(--color-ink-soft)]">Resultado</span><span className="text-right font-medium" style={{ color: 'var(--color-done)' }}>{fmtBRL(t.resultado)}</span>
          <span className="text-[var(--color-ink-soft)]">Margem</span><span className="text-right font-medium">{fmtPct(t.margem)}</span>
        </div>
      </button>
      <div className="mt-1 flex gap-1 border-t border-[var(--color-line)] pt-2">
        <button className="btn-secondary" onClick={onAbrir}>Abrir</button>
        <button className="btn-ghost" onClick={onDuplicar}>Duplicar</button>
        <button className="btn-ghost ml-auto text-[var(--color-overdue)]" onClick={onExcluir}>Excluir</button>
      </div>
    </div>
  );
}
