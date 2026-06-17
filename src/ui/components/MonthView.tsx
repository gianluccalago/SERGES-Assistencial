import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { useMonthObligations, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { lastDayOfMonth, utcDate } from '../../domain/dateUtils';
import { DOW_CURTO, todayISO, ESTADO_LABEL, estadoChipClass, DOW_LONGO, MESES } from '../format';
import type { CalendarItem } from '../../domain/types';

const MAX_VISIVEL = 3;

export function MonthView({
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
  const store = useStore();
  const items = applyFiltros(useMonthObligations(year, month), filtros);
  const today = todayISO();
  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, ResolvedObligation[]>();
    for (const ro of items) {
      if (!ro.prazo || !ro.prazo.startsWith(`${year}-${String(month).padStart(2, '0')}`)) continue;
      const arr = map.get(ro.prazo) ?? [];
      arr.push(ro);
      map.set(ro.prazo, arr);
    }
    return map;
  }, [items, year, month]);

  const firstDow = utcDate(year, month, 1).getUTCDay();
  const totalDays = lastDayOfMonth(year, month);
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const diasComItens = [...byDay.keys()].sort();

  function onDrop(dayISO: string) {
    if (dragItem) store.moveItem(dragItem, dayISO);
    setDragItem(null);
  }

  return (
    <>
      {/* Desktop: grade completa */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-2">
          {DOW_CURTO.map((d) => (
            <div key={d} className="label px-2 pb-1 uppercase">
              {d}
            </div>
          ))}
          {cells.map((dISO, i) => {
            if (!dISO) return <div key={i} className="min-h-[128px] rounded-[var(--radius-md)] bg-[var(--color-surface-muted)]/40" />;
            const day = Number(dISO.slice(8, 10));
            const isToday = dISO === today;
            const dayItems = byDay.get(dISO) ?? [];
            const visiveis = dayItems.slice(0, MAX_VISIVEL);
            const resto = dayItems.length - visiveis.length;
            return (
              <div
                key={i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(dISO)}
                className="card min-h-[128px] p-2"
              >
                <div className="mb-1.5 flex justify-end">
                  <span
                    className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[length:var(--text-label)] font-semibold ${
                      isToday
                        ? 'bg-[var(--color-serges-blue)] text-white'
                        : 'text-[var(--color-ink)]'
                    }`}
                  >
                    {day}
                  </span>
                </div>
                <div className="space-y-1">
                  {visiveis.map((ro) => (
                    <button
                      key={ro.item.id}
                      draggable={!!ro.prazo}
                      onDragStart={() => setDragItem(ro.item)}
                      onClick={() => onSelect(ro)}
                      title={`${ro.item.titulo} — ${ESTADO_LABEL[ro.estado]}`}
                      className={`block w-full truncate rounded-[6px] border-l-[3px] bg-[var(--color-surface-muted)] px-1.5 py-1 text-left text-[length:var(--text-label)] leading-snug ${
                        ro.atrasada
                          ? 'border-l-[var(--color-overdue)] text-[var(--color-overdue)]'
                          : ro.estado === 'concluida'
                            ? 'border-l-[var(--color-done)] text-[var(--color-ink-soft)] line-through'
                            : ro.critico
                              ? 'border-l-[var(--color-serges-blue)] text-[var(--color-ink)]'
                              : 'border-l-transparent text-[var(--color-ink)]'
                      }`}
                    >
                      {ro.item.titulo}
                    </button>
                  ))}
                  {resto > 0 && (
                    <button
                      className="btn-ghost w-full text-left text-[length:var(--text-caption)]"
                      onClick={() => setOpenDay(dISO)}
                    >
                      +{resto} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: faixa enxuta, agenda por dia com itens */}
      <div className="space-y-[var(--spacing-12)] md:hidden">
        {diasComItens.length === 0 && <div className="label">Nenhuma obrigação neste mês.</div>}
        {diasComItens.map((dISO) => (
          <DayBlock key={dISO} dISO={dISO} items={byDay.get(dISO) ?? []} onSelect={onSelect} today={today} />
        ))}
      </div>

      {/* Expansão de um dia (desktop "+N mais") */}
      {openDay && (
        <DayModal
          dISO={openDay}
          items={byDay.get(openDay) ?? []}
          onSelect={(ro) => {
            setOpenDay(null);
            onSelect(ro);
          }}
          onClose={() => setOpenDay(null)}
        />
      )}
    </>
  );
}

function DayBlock({
  dISO,
  items,
  onSelect,
  today,
}: {
  dISO: string;
  items: ResolvedObligation[];
  onSelect: (ro: ResolvedObligation) => void;
  today: string;
}) {
  const d = utcDate(Number(dISO.slice(0, 4)), Number(dISO.slice(5, 7)), Number(dISO.slice(8, 10)));
  const isToday = dISO === today;
  return (
    <div className="card p-[var(--spacing-12)]">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[length:var(--text-label)] font-semibold ${
            isToday ? 'bg-[var(--color-serges-blue)] text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-ink)]'
          }`}
        >
          {d.getUTCDate()}
        </span>
        <span className="label">{DOW_LONGO[d.getUTCDay()]}, {d.getUTCDate()} de {MESES[d.getUTCMonth()]}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((ro) => (
          <button
            key={ro.item.id}
            onClick={() => onSelect(ro)}
            className={`flex w-full items-center justify-between gap-2 rounded-[8px] border-l-[3px] bg-[var(--color-surface-muted)] px-2 py-2 text-left ${
              ro.atrasada ? 'border-l-[var(--color-overdue)]' : ro.critico ? 'border-l-[var(--color-serges-blue)]' : 'border-l-transparent'
            }`}
          >
            <span className="text-[length:var(--text-label)]">{ro.item.titulo}</span>
            <span className={estadoChipClass(ro.estado)}>{ESTADO_LABEL[ro.estado]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DayModal({
  dISO,
  items,
  onSelect,
  onClose,
}: {
  dISO: string;
  items: ResolvedObligation[];
  onSelect: (ro: ResolvedObligation) => void;
  onClose: () => void;
}) {
  const d = utcDate(Number(dISO.slice(0, 4)), Number(dISO.slice(5, 7)), Number(dISO.slice(8, 10)));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card w-full max-w-[420px] p-[var(--spacing-20)]" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3">{d.getUTCDate()} de {MESES[d.getUTCMonth()]}</h3>
        <div className="space-y-1.5">
          {items.map((ro) => (
            <button
              key={ro.item.id}
              onClick={() => onSelect(ro)}
              className="flex w-full items-center justify-between gap-2 rounded-[8px] bg-[var(--color-surface-muted)] px-2 py-2 text-left"
            >
              <span className="text-[length:var(--text-label)]">{ro.item.titulo}</span>
              <span className={estadoChipClass(ro.estado)}>{ESTADO_LABEL[ro.estado]}</span>
            </button>
          ))}
        </div>
        <button className="btn-secondary mt-4 w-full" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
