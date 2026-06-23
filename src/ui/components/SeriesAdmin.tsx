import { useStore } from '../../state/store';
import type { AjusteDiaUtil, TarefaFixa } from '../../domain/types';

const MODO_LABEL: Record<AjusteDiaUtil, string> = {
  antecipa: 'Antecipa (recua p/ dia útil anterior)',
  adia: 'Adia (vai p/ próximo dia útil)',
  nenhum: 'Sem ajuste de dia útil',
};

export function SeriesAdmin() {
  const store = useStore();
  const series = [...store.state.tarefasFixas].sort((a, b) => a.dia - b.dia);

  function novo() {
    store.upsertTarefaFixa({ chave: `serie-${crypto.randomUUID().slice(0, 6)}`, dia: 1, titulo: 'Nova série', modo: 'adia' });
  }

  return (
    <div className="mx-auto max-w-[760px] space-y-2">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h2 className="text-[length:var(--text-heading)]">Séries (compromissos mensais)</h2>
          <p className="label mt-1">Alterar o dia-âncora ou a regra recalcula automaticamente todas as datas, em todos os meses.</p>
        </div>
        <button className="btn-primary" onClick={novo}>+ Nova série</button>
      </div>

      {series.length === 0 && <p className="text-[var(--color-ink-soft)]">Nenhuma série cadastrada.</p>}

      {series.map((t) => (
        <SerieCard key={t.chave} t={t} onChange={(patch) => store.upsertTarefaFixa({ ...t, ...patch })} onRemove={() => store.removeTarefaFixa(t.chave)} />
      ))}
    </div>
  );
}

function SerieCard({ t, onChange, onRemove }: { t: TarefaFixa; onChange: (p: Partial<TarefaFixa>) => void; onRemove: () => void }) {
  return (
    <div className="card p-[var(--spacing-16)]" style={{ borderLeft: `3px solid ${t.critico ? 'var(--color-overdue)' : 'var(--color-line)'}` }}>
      <input
        className="input font-medium"
        defaultValue={t.titulo}
        placeholder="Título da série"
        onBlur={(e) => e.target.value !== t.titulo && onChange({ titulo: e.target.value })}
      />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_auto]">
        <label className="block">
          <span className="label mb-1 block">Dia-âncora</span>
          <input
            className="input"
            type="number"
            min={1}
            max={31}
            value={t.dia}
            onChange={(e) => onChange({ dia: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
        <label className="block">
          <span className="label mb-1 block">Regra de dia útil</span>
          <select className="select" value={t.modo} onChange={(e) => onChange({ modo: e.target.value as AjusteDiaUtil })}>
            {(Object.keys(MODO_LABEL) as AjusteDiaUtil[]).map((m) => <option key={m} value={m}>{MODO_LABEL[m]}</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-[length:var(--text-label)]">
          <input type="checkbox" checked={!!t.critico} onChange={(e) => onChange({ critico: e.target.checked })} />
          Crítico
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="label">Regra de origem: dia-âncora {t.dia}, regra de dia útil ({t.modo}).</span>
        <button className="btn-ghost text-[var(--color-overdue)]" onClick={onRemove}>Excluir série</button>
      </div>
    </div>
  );
}
