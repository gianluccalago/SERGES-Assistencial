import { useMemo, useState } from 'react';
import { useMonthObligations, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { ObligationCard } from './ObligationCard';
import { ESTADO_LABEL, formatDateShort } from '../format';
import { fromISODate } from '../../domain/dateUtils';
import type { ObligationEstado } from '../../domain/types';

const ORDEM_ESTADO: ObligationEstado[] = ['pendente', 'aguardandoInput', 'emAprovacao', 'concluida'];

export function ListView({
  year,
  month,
  filtros,
  onSelect,
}: {
  year: number;
  month: number;
  filtros: Filtros;
  onSelect: (ro: ResolvedObligation) => void;
}) {
  const items = applyFiltros(useMonthObligations(year, month), filtros);
  const [estadoFiltro, setEstadoFiltro] = useState<ObligationEstado | 'todos'>('todos');
  const [agruparLotes, setAgruparLotes] = useState(false);

  const filtrados = useMemo(() => {
    return items
      .filter((ro) => (estadoFiltro === 'todos' ? true : ro.estado === estadoFiltro))
      .sort((a, b) => {
        // Atrasadas e aguardando-contratante primeiro (destaque, §6.1).
        const pa = a.atrasada ? 0 : a.estado === 'aguardandoInput' ? 1 : 2;
        const pb = b.atrasada ? 0 : b.estado === 'aguardandoInput' ? 1 : 2;
        if (pa !== pb) return pa - pb;
        const ea = ORDEM_ESTADO.indexOf(a.estado);
        const eb = ORDEM_ESTADO.indexOf(b.estado);
        if (ea !== eb) return ea - eb;
        return (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999');
      });
  }, [items, estadoFiltro]);

  // §11 — agrupar cardPagamento por data de pagamento (lotes dos dias 10, 15, 25).
  const lotes = useMemo(() => {
    const cards = filtrados.filter((ro) => ro.item.tipo === 'cardPagamento' && ro.prazo);
    const map = new Map<string, ResolvedObligation[]>();
    for (const ro of cards) {
      const k = ro.prazo!;
      const arr = map.get(k) ?? [];
      arr.push(ro);
      map.set(k, arr);
    }
    const outros = filtrados.filter((ro) => !(ro.item.tipo === 'cardPagamento' && ro.prazo));
    return { grupos: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])), outros };
  }, [filtrados]);

  return (
    <div>
      <div className="mb-[var(--spacing-16)] flex flex-wrap items-center gap-2">
        <button className="pill" data-active={estadoFiltro === 'todos'} onClick={() => setEstadoFiltro('todos')}>
          Todos
        </button>
        {ORDEM_ESTADO.map((e) => (
          <button key={e} className="pill" data-active={estadoFiltro === e} onClick={() => setEstadoFiltro(e)}>
            {ESTADO_LABEL[e]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[length:var(--text-label)]">
          <input type="checkbox" checked={agruparLotes} onChange={(e) => setAgruparLotes(e.target.checked)} />
          Agrupar cards por lote de pagamento
        </label>
      </div>

      {!agruparLotes ? (
        <div className="space-y-2">
          {filtrados.length === 0 && <div className="label">Nenhuma obrigação com os filtros atuais.</div>}
          {filtrados.map((ro) => (
            <ObligationCard key={ro.item.id} ro={ro} onSelect={onSelect} variant="list" />
          ))}
        </div>
      ) : (
        <div className="space-y-[var(--spacing-20)]">
          {lotes.grupos.map(([dia, arr]) => (
            <div key={dia}>
              <div className="label mb-2 uppercase">
                Lote de pagamento · {formatDateShort(dia)} (dia {fromISODate(dia).getUTCDate()})
              </div>
              <div className="space-y-2">
                {arr.map((ro) => (
                  <ObligationCard key={ro.item.id} ro={ro} onSelect={onSelect} variant="list" />
                ))}
              </div>
            </div>
          ))}
          {lotes.outros.length > 0 && (
            <div>
              <div className="label mb-2 uppercase">Outras obrigações</div>
              <div className="space-y-2">
                {lotes.outros.map((ro) => (
                  <ObligationCard key={ro.item.id} ro={ro} onSelect={onSelect} variant="list" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
