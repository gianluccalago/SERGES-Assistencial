import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { resolveItem, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { ObligationCard } from './ObligationCard';
import { addCalendarDays, fromISODate, toISODate } from '../../domain/dateUtils';
import { DOW_LONGO, MESES, todayISO, estadoChipClass, ESTADO_LABEL } from '../format';
import { isAguardando } from '../../domain/resolve';
import type { CalendarItem } from '../../domain/types';

export function WeekView({
  anchorISO,
  filtros,
  onSelect,
}: {
  anchorISO: string;
  filtros: Filtros;
  onSelect: (ro: ResolvedObligation) => void;
}) {
  const store = useStore();
  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const today = todayISO();
  const nowISO = new Date().toISOString();

  const days = useMemo(() => {
    const anchor = fromISODate(anchorISO);
    const start = addCalendarDays(anchor, -anchor.getUTCDay());
    return Array.from({ length: 7 }, (_, i) => toISODate(addCalendarDays(start, i)));
  }, [anchorISO]);

  // Coleta itens dos meses cobertos pela semana (pode cruzar a virada de mês).
  const all = useMemo(() => {
    const months = new Set(days.map((d) => d.slice(0, 7)));
    const map = new Map<string, ResolvedObligation>();
    for (const ym of months) {
      const [y, m] = ym.split('-').map(Number);
      for (const item of store.itemsFor(y, m)) {
        map.set(item.id, resolveItem(item, today, nowISO));
      }
    }
    return applyFiltros([...map.values()], filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state, days, filtros, today]);

  const byDay = useMemo(() => {
    const map = new Map<string, ResolvedObligation[]>();
    for (const ro of all) {
      if (!ro.prazo) continue;
      const arr = map.get(ro.prazo) ?? [];
      arr.push(ro);
      map.set(ro.prazo, arr);
    }
    return map;
  }, [all]);

  const aguardando = all.filter((ro) => isAguardando(ro.item));

  function onDrop(dayISO: string) {
    if (dragItem) store.moveItem(dragItem, dayISO);
    setDragItem(null);
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-[var(--spacing-12)] md:grid-cols-7">
        {days.map((dISO) => {
          const d = fromISODate(dISO);
          const isToday = dISO === today;
          const items = byDay.get(dISO) ?? [];
          return (
            <div
              key={dISO}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(dISO)}
              className={`card min-h-[160px] p-[var(--spacing-12)] ${
                isToday ? 'ring-2 ring-[var(--color-serges-blue)]' : ''
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span className="label uppercase">{DOW_LONGO[d.getUTCDay()]}</span>
                <span
                  className={`text-[length:var(--text-subheading)] font-semibold ${
                    isToday ? 'text-[var(--color-serges-blue)]' : 'text-[var(--color-ink)]'
                  }`}
                >
                  {d.getUTCDate()}
                  <span className="label ml-1 font-normal">{MESES[d.getUTCMonth()].slice(0, 3)}</span>
                </span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <div className="label opacity-60">—</div>}
                {items.map((ro) => (
                  <ObligationCard
                    key={ro.item.id}
                    ro={ro}
                    onSelect={onSelect}
                    draggable={!!ro.prazo}
                    onDragStart={() => setDragItem(ro.item)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {aguardando.length > 0 && (
        <div className="mt-[var(--spacing-24)]">
          <div className="label mb-2 uppercase">Aguardando retorno de terceiro (sem prazo)</div>
          <div className="flex flex-wrap gap-2">
            {aguardando.map((ro) => (
              <button key={ro.item.id} onClick={() => onSelect(ro)} className={estadoChipClass(ro.estado)}>
                {ro.item.titulo} · {ESTADO_LABEL[ro.estado]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
