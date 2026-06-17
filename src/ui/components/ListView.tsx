import { useMemo, useState } from 'react';
import { useMonthObligations, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { ObligationCard } from './ObligationCard';
import { ESTADO_LABEL } from '../format';
import type { ObligationEstado } from '../../domain/types';

const ORDEM_ESTADO: ObligationEstado[] = [
  'atrasada',
  'escalada',
  'emCobranca',
  'aguardandoRetorno',
  'pendente',
  'concluida',
];

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

  const filtrados = useMemo(() => {
    return items
      .filter((ro) => (estadoFiltro === 'todos' ? true : ro.estado === estadoFiltro))
      .sort((a, b) => {
        const ea = ORDEM_ESTADO.indexOf(a.estado);
        const eb = ORDEM_ESTADO.indexOf(b.estado);
        if (ea !== eb) return ea - eb;
        return (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999');
      });
  }, [items, estadoFiltro]);

  return (
    <div>
      <div className="mb-[var(--spacing-16)] flex flex-wrap items-center gap-2">
        <button
          className="pill"
          data-active={estadoFiltro === 'todos'}
          onClick={() => setEstadoFiltro('todos')}
        >
          Todos
        </button>
        {ORDEM_ESTADO.map((e) => (
          <button key={e} className="pill" data-active={estadoFiltro === e} onClick={() => setEstadoFiltro(e)}>
            {ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtrados.length === 0 && <div className="label">Nenhuma obrigação com os filtros atuais.</div>}
        {filtrados.map((ro) => (
          <ObligationCard key={ro.item.id} ro={ro} onSelect={onSelect} variant="list" />
        ))}
      </div>
    </div>
  );
}
