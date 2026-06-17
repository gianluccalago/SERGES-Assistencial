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
      <button className="btn-ghost" onClick={() => setAberto((v) => !v)}>
        {ocultadas.length} obrigação(ões) oculta(s) {aberto ? '▴' : '▾'}
      </button>
      {aberto && (
        <div className="card mt-2 p-[var(--spacing-12)]">
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
