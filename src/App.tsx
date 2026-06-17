import { useMemo, useState } from 'react';
import { WeekView } from './ui/components/WeekView';
import { MonthView } from './ui/components/MonthView';
import { ListView } from './ui/components/ListView';
import { ProjectsAdmin } from './ui/components/ProjectsAdmin';
import { HolidaysAdmin } from './ui/components/HolidaysAdmin';
import { ObligationDetail } from './ui/components/ObligationDetail';
import { ManualForm } from './ui/components/ManualForm';
import { SergesLogo } from './ui/components/Logo';
import { useStore } from './state/store';
import type { ResolvedObligation } from './ui/useObligations';
import type { Filtros } from './ui/filters';
import { MESES, todayISO, formatDateShort } from './ui/format';
import { addCalendarDays, fromISODate, toISODate } from './domain/dateUtils';

type Screen = 'semana' | 'mes' | 'lista' | 'projetos' | 'feriados';

const VIEW_TABS: Array<{ id: Screen; label: string }> = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'lista', label: 'Lista' },
];

export function App() {
  const store = useStore();
  const [screen, setScreen] = useState<Screen>('semana');
  const [cursorISO, setCursorISO] = useState<string>(todayISO());
  const [filtros, setFiltros] = useState<Filtros>({ projeto: 'todos', escalista: 'todos' });
  const [selected, setSelected] = useState<ResolvedObligation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editManualId, setEditManualId] = useState<string | undefined>(undefined);

  const cursor = fromISODate(cursorISO);
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth() + 1;

  const escalistas = useMemo(() => {
    const set = new Set<string>();
    store.state.projects.forEach((p) => p.escalista && set.add(p.escalista));
    return [...set].sort();
  }, [store.state.projects]);

  const isCalendar = screen === 'semana' || screen === 'mes' || screen === 'lista';

  function shift(delta: number) {
    if (screen === 'semana') {
      setCursorISO(toISODate(addCalendarDays(cursor, 7 * delta)));
    } else {
      const idx = year * 12 + (month - 1) + delta;
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      setCursorISO(`${y}-${String(m).padStart(2, '0')}-01`);
    }
  }

  const periodoLabel = useMemo(() => {
    if (screen === 'semana') {
      const start = addCalendarDays(cursor, -cursor.getUTCDay());
      const end = addCalendarDays(start, 6);
      return `${formatDateShort(toISODate(start))} – ${formatDateShort(toISODate(end))}`;
    }
    return `${MESES[month - 1]} de ${year}`;
  }, [screen, cursorISO, month, year]);

  function openNew() {
    setEditManualId(undefined);
    setFormOpen(true);
  }

  return (
    <div className="min-h-full">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-[var(--spacing-16)] py-[var(--spacing-12)] md:px-[var(--spacing-24)]">
          <SergesLogo />
          <span className="label hidden sm:inline">· Calendário de Obrigações</span>

          <nav className="ml-auto flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] p-1">
            {VIEW_TABS.map((t) => (
              <button key={t.id} className="pill" data-active={screen === t.id} onClick={() => setScreen(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button className="btn-ghost" data-active={screen === 'projetos'} onClick={() => setScreen('projetos')}>
              Projetos
            </button>
            <button className="btn-ghost" data-active={screen === 'feriados'} onClick={() => setScreen('feriados')}>
              Feriados
            </button>
          </div>

          <button className="btn-primary" onClick={openNew}>
            + Nova obrigação
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-[var(--spacing-16)] py-[var(--spacing-20)] md:px-[var(--spacing-24)]">
        {/* Barra de período + filtros (somente nas visões de calendário) */}
        {isCalendar && (
          <div className="mb-[var(--spacing-20)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={() => shift(-1)} aria-label="Anterior">
                ‹
              </button>
              <div className="min-w-[160px] text-center font-semibold text-[var(--color-ink)]">{periodoLabel}</div>
              <button className="btn-secondary" onClick={() => shift(1)} aria-label="Próximo">
                ›
              </button>
              <button className="btn-ghost" onClick={() => setCursorISO(todayISO())}>
                Hoje
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="select w-auto"
                value={filtros.projeto}
                onChange={(e) => setFiltros((f) => ({ ...f, projeto: e.target.value }))}
              >
                <option value="todos">Todos os projetos</option>
                {store.state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <select
                className="select w-auto"
                value={filtros.escalista}
                onChange={(e) => setFiltros((f) => ({ ...f, escalista: e.target.value }))}
              >
                <option value="todos">Todos os escalistas</option>
                {escalistas.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {screen === 'semana' && <WeekView anchorISO={cursorISO} filtros={filtros} onSelect={setSelected} />}
        {screen === 'mes' && <MonthView year={year} month={month} filtros={filtros} onSelect={setSelected} />}
        {screen === 'lista' && <ListView year={year} month={month} filtros={filtros} onSelect={setSelected} />}
        {screen === 'projetos' && <ProjectsAdmin />}
        {screen === 'feriados' && <HolidaysAdmin year={year} />}
      </main>

      {selected && (
        <ObligationDetail
          ro={selected}
          onClose={() => setSelected(null)}
          onEditManual={(id) => {
            setSelected(null);
            setEditManualId(id);
            setFormOpen(true);
          }}
        />
      )}
      {formOpen && <ManualForm editId={editManualId} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
