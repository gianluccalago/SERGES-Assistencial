import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { resolveItem, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { ObligationCard } from './ObligationCard';
import { AguardandoContratante } from './DayView';
import { addCalendarDays, fromISODate, toISODate } from '../../domain/dateUtils';
import { DOW_LONGO, MESES, todayISO } from '../format';
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
      {/* Uma linha por dia; obrigações fluem na horizontal, fáceis de ler. */}
      <div className="space-y-2">
        {days.map((dISO) => {
          const d = fromISODate(dISO);
          const isToday = dISO === today;
          const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
          const items = byDay.get(dISO) ?? [];
          return (
            <div
              key={dISO}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(dISO)}
              className={`card flex flex-col gap-3 p-[var(--spacing-12)] transition-colors duration-150 sm:flex-row sm:items-stretch ${
                isToday ? 'border-l-[3px] border-l-[var(--color-serges-blue)]' : ''
              } ${isWeekend ? 'bg-[var(--color-surface-muted)]' : ''} ${dragItem ? 'outline-dashed outline-1 outline-offset-2 outline-[var(--color-serges-blue-tint)]' : ''}`}
            >
              {/* Coluna fixa do dia */}
              <div className="flex shrink-0 items-center gap-3 sm:w-[120px] sm:flex-col sm:items-start sm:justify-start sm:border-r sm:border-[var(--color-line)] sm:pr-3">
                <span
                  className={`display flex h-9 w-9 items-center justify-center rounded-full text-[length:var(--text-subheading)] ${
                    isToday ? 'bg-[var(--color-serges-blue)] text-white' : 'text-[var(--color-ink)]'
                  }`}
                >
                  {d.getUTCDate()}
                </span>
                <div className="leading-tight">
                  <div className="text-[length:var(--text-label)] font-medium capitalize text-[var(--color-ink)]">
                    {DOW_LONGO[d.getUTCDay()]}
                  </div>
                  <div className="label">{MESES[d.getUTCMonth()]}</div>
                </div>
              </div>

              {/* Área de obrigações: flui na horizontal e quebra para a próxima linha */}
              <div className="flex flex-1 flex-wrap content-start gap-2">
                {items.length === 0 ? (
                  <span className="label self-center opacity-60">Sem obrigações</span>
                ) : (
                  items.map((ro) => (
                    <div key={ro.item.id} className="w-full sm:w-[260px]">
                      <ObligationCard
                        ro={ro}
                        onSelect={onSelect}
                        draggable={!!ro.prazo}
                        onDragStart={() => setDragItem(ro.item)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {aguardando.length > 0 && (
        <AguardandoContratante itens={aguardando} onSelect={onSelect} />
      )}
    </div>
  );
}
