import { useMemo } from 'react';
import { useMonthObligations, type ResolvedObligation } from '../useObligations';
import { lastDayOfMonth, utcDate } from '../../domain/dateUtils';
import { todayISO, estadoChipClass, ESTADO_LABEL } from '../format';

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function CalendarView({
  year,
  month,
  onSelect,
}: {
  year: number;
  month: number;
  onSelect: (item: ResolvedObligation) => void;
}) {
  const items = useMonthObligations(year, month);
  const today = todayISO();

  const byDay = useMemo(() => {
    const map = new Map<number, ResolvedObligation[]>();
    for (const it of items) {
      if (!it.prazo) continue;
      if (!it.prazo.startsWith(`${year}-${String(month).padStart(2, '0')}`)) continue;
      const day = Number(it.prazo.slice(8, 10));
      const arr = map.get(day) ?? [];
      arr.push(it);
      map.set(day, arr);
    }
    return map;
  }, [items, year, month]);

  const firstDow = utcDate(year, month, 1).getUTCDay();
  const days = lastDayOfMonth(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Obrigações sem prazo (aguardando retorno de terceiro), mostradas à parte.
  const semPrazo = items.filter((it) => !it.prazo);

  return (
    <div>
      <div className="grid grid-cols-7 gap-px">
        {DOW.map((d) => (
          <div key={d} className="label px-2 py-1 uppercase">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const iso = d ? `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
          const isToday = iso === today;
          const dayItems = d ? byDay.get(d) ?? [] : [];
          return (
            <div
              key={i}
              className={`surface min-h-[104px] p-2 ${d ? 'hairline' : 'opacity-30'}`}
            >
              {d && (
                <div
                  className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center px-1 text-[length:var(--text-caption)] ${
                    isToday
                      ? 'rounded-full bg-[var(--color-ember)] text-[var(--color-bone)]'
                      : 'text-[var(--color-ash)]'
                  }`}
                >
                  {d}
                </div>
              )}
              <div className="space-y-1">
                {dayItems.map((it) => (
                  <button
                    key={it.obligation.id}
                    onClick={() => onSelect(it)}
                    className={`block w-full truncate border-l-2 px-1 py-0.5 text-left text-[length:var(--text-caption)] leading-tight ${
                      it.estado === 'atrasada'
                        ? 'border-[var(--color-ember)] text-[var(--color-ember)]'
                        : it.estado === 'concluida'
                          ? 'border-transparent text-[var(--color-ash)] line-through opacity-50'
                          : it.obligation.critico
                            ? 'border-[var(--color-ash)] text-[var(--color-bone)]'
                            : 'border-transparent text-[var(--color-ash)]'
                    }`}
                    title={`${it.obligation.titulo} — ${ESTADO_LABEL[it.estado]}`}
                  >
                    {it.obligation.titulo}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {semPrazo.length > 0 && (
        <div className="mt-[var(--spacing-24)]">
          <div className="label mb-2 uppercase">Aguardando retorno de terceiro (sem prazo)</div>
          <div className="flex flex-wrap gap-2">
            {semPrazo.map((it) => (
              <button key={it.obligation.id} onClick={() => onSelect(it)} className={estadoChipClass(it.estado)}>
                {it.obligation.titulo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
