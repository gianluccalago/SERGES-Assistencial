import { useState } from 'react';
import { CalendarView } from './ui/components/CalendarView';
import { ListView } from './ui/components/ListView';
import { ProjectsAdmin } from './ui/components/ProjectsAdmin';
import { HolidaysAdmin } from './ui/components/HolidaysAdmin';
import { ObligationDetail } from './ui/components/ObligationDetail';
import { EventoForm } from './ui/components/EventoForm';
import type { ResolvedObligation } from './ui/useObligations';
import { MESES } from './ui/format';

type Screen = 'calendario' | 'lista' | 'projetos' | 'feriados';

const TABS: Array<{ id: Screen; label: string }> = [
  { id: 'calendario', label: 'Calendário' },
  { id: 'lista', label: 'Lista por estado' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'feriados', label: 'Feriados' },
];

export function App() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [screen, setScreen] = useState<Screen>('calendario');
  const [selected, setSelected] = useState<ResolvedObligation | null>(null);
  const [showEvento, setShowEvento] = useState(false);

  function shiftMonth(delta: number) {
    const idx = (year * 12 + (month - 1) + delta);
    setYear(Math.floor(idx / 12));
    setMonth((idx % 12) + 1);
  }

  const mostraMes = screen === 'calendario' || screen === 'lista' || screen === 'feriados';

  return (
    <div className="mx-auto min-h-full max-w-[1200px] px-[var(--spacing-24)] py-[var(--spacing-24)]">
      <header className="mb-[var(--spacing-24)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="label uppercase">SERGES · Assistente de Projetos</div>
          <h1 className="text-[length:var(--text-subheading)]">Calendário de Obrigações</h1>
        </div>
        <nav className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="btn-secondary"
              data-active={screen === t.id}
              onClick={() => setScreen(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {mostraMes && (
        <div className="mb-[var(--spacing-20)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button className="btn-secondary" data-active onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <div className="min-w-[180px] text-center text-[var(--color-bone)]">
              {MESES[month - 1]} de {year}
            </div>
            <button className="btn-secondary" data-active onClick={() => shiftMonth(1)}>
              ›
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setYear(now.getFullYear());
                setMonth(now.getMonth() + 1);
              }}
            >
              Hoje
            </button>
          </div>
          {screen === 'calendario' && (
            <button className="btn-primary" onClick={() => setShowEvento(true)}>
              Registrar evento
            </button>
          )}
        </div>
      )}

      <main>
        {screen === 'calendario' && <CalendarView year={year} month={month} onSelect={setSelected} />}
        {screen === 'lista' && <ListView year={year} month={month} onSelect={setSelected} />}
        {screen === 'projetos' && <ProjectsAdmin />}
        {screen === 'feriados' && <HolidaysAdmin year={year} />}
      </main>

      {selected && <ObligationDetail item={selected} onClose={() => setSelected(null)} />}
      {showEvento && (
        <EventoForm year={year} month={month} onClose={() => setShowEvento(false)} />
      )}
    </div>
  );
}
