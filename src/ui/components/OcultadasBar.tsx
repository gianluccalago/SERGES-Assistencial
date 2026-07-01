import { useState } from 'react';
import { useStore } from '../../state/store';

// Mostra as obrigações geradas que foram ocultadas (dismissed) no mês e permite
// desfazer, reexibindo-as (§6.2). Aparece só quando há ocultadas.
export function OcultadasBar({ year, month }: { year: number; month: number }) {
  const store = useStore();
  const [aberto, setAberto] = useState(false);
  const ocultadas = store.dismissedItemsFor(year, month);
  if (ocultadas.length === 0) return null;

  return (
    <div className="mb-[var(--spacing-16)]">
      <button className="btn-ghost inline-flex items-center gap-1.5" onClick={() => setAberto((v) => !v)}>
        {ocultadas.length} obrigação(ões) oculta(s)
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${aberto ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {aberto && (
        <div className="well mt-2 p-[var(--spacing-12)]">
          <div className="space-y-1.5">
            {ocultadas.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 text-[length:var(--text-label)]">
                <span className="min-w-0 truncate text-[var(--color-ink-soft)] line-through">{o.titulo}</span>
                <button className="btn-secondary" onClick={() => store.undismiss(o.id)}>
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
