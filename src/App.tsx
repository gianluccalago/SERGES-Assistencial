import { useEffect, useMemo, useState } from 'react';
import { DayView } from './ui/components/DayView';
import { WeekView } from './ui/components/WeekView';
import { MonthView } from './ui/components/MonthView';
import { ListView } from './ui/components/ListView';
import { ChecklistView } from './ui/components/ChecklistView';
import { ContatosPage } from './ui/components/ContatosPage';
import { ProjectsAdmin } from './ui/components/ProjectsAdmin';
import { SeriesAdmin } from './ui/components/SeriesAdmin';
import { ObligationDetail } from './ui/components/ObligationDetail';
import { ManualForm } from './ui/components/ManualForm';
import { OcultadasBar } from './ui/components/OcultadasBar';
import { Sidebar } from './ui/components/Sidebar';
import { ComercialPage } from './ui/comercial/ComercialPage';
import { ApresentacaoPage } from './ui/apresentacao/ApresentacaoPage';
import { UsersAdmin } from './ui/components/UsersAdmin';
import { AdminGuard } from './ui/components/AdminGuard';
import { useStore } from './state/store';
import { useAuth } from './auth/AuthProvider';
import { useMonthObligations, type ResolvedObligation } from './ui/useObligations';
import type { Filtros } from './ui/filters';
import { MESES, todayISO, formatDateShort } from './ui/format';
import { addCalendarDays, fromISODate, toISODate } from './domain/dateUtils';

type View = 'dia' | 'semana' | 'mes' | 'lista' | 'checklist';
type Screen = View | 'contatos' | 'projetos' | 'series' | 'comercial' | 'apresentacao' | 'usuarios';

const VIEW_TABS: Array<{ id: View; label: string }> = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'lista', label: 'Lista' },
  { id: 'checklist', label: 'Checklist' },
];

const TITULO_PAGINA: Record<Screen, string> = {
  dia: 'Calendário de Obrigações',
  semana: 'Calendário de Obrigações',
  mes: 'Calendário de Obrigações',
  lista: 'Calendário de Obrigações',
  checklist: 'Calendário de Obrigações',
  contatos: 'Contatos',
  projetos: 'Projetos',
  series: 'Séries',
  comercial: 'Setor Comercial Público',
  apresentacao: 'Apresentação de Resultados',
  usuarios: 'Usuários',
};

export function App() {
  const store = useStore();
  const { isGestor } = useAuth();
  const [screen, setScreen] = useState<Screen>('dia');
  const [view, setView] = useState<View>('dia');
  const [cursorISO, setCursorISO] = useState<string>(todayISO());
  const [filtros, setFiltros] = useState<Filtros>({ projeto: 'todos', escalista: 'todos' });
  const [selected, setSelected] = useState<ResolvedObligation | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const cursor = fromISODate(cursorISO);
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth() + 1;

  const isCalendar = screen === 'dia' || screen === 'semana' || screen === 'mes' || screen === 'lista' || screen === 'checklist';
  const monthItems = useMonthObligations(year, month);

  const contadores = useMemo(() => {
    const today = todayISO();
    let atrasadas = 0;
    let aguardando = 0;
    let vencendo = 0;
    let concluidas = 0;
    for (const ro of monthItems) {
      if (ro.estado === 'concluida' || ro.item.resolucaoMes === 'semAtuacao') concluidas++;
      if (ro.atrasada) atrasadas++;
      if (ro.estado === 'aguardandoInput') aguardando++;
      if (ro.prazo && !ro.atrasada && ro.estado !== 'concluida') {
        const dias = Math.round((fromISODate(ro.prazo).getTime() - fromISODate(today).getTime()) / 86400000);
        if (dias >= 0 && dias <= 2) vencendo++;
      }
    }
    return { atrasadas, aguardando, vencendo, concluidas, total: monthItems.length };
  }, [monthItems]);

  const escalistas = useMemo(() => {
    const set = new Set<string>();
    store.state.projects.forEach((p) => p.escalista && set.add(p.escalista));
    return [...set].sort();
  }, [store.state.projects]);

  function shift(delta: number) {
    if (screen === 'dia') setCursorISO(toISODate(addCalendarDays(cursor, delta)));
    else if (screen === 'semana') setCursorISO(toISODate(addCalendarDays(cursor, 7 * delta)));
    else {
      const idx = year * 12 + (month - 1) + delta;
      setCursorISO(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`);
    }
  }

  const periodoLabel = useMemo(() => {
    if (screen === 'dia') return formatDateShort(cursorISO) + '/' + year;
    if (screen === 'semana') {
      const start = addCalendarDays(cursor, -cursor.getUTCDay());
      return `${formatDateShort(toISODate(start))} – ${formatDateShort(toISODate(addCalendarDays(start, 6)))}`;
    }
    return `${MESES[month - 1]} de ${year}`;
  }, [screen, cursorISO, month, year]);

  function navegar(d: 'calendario' | 'contatos' | 'projetos' | 'series' | 'comercial' | 'apresentacao' | 'usuarios') {
    setScreen(d === 'calendario' ? view : d);
  }
  function trocarView(v: View) {
    setView(v);
    setScreen(v);
  }

  return (
    <div className="flex min-h-full">
      <Sidebar active={isCalendar ? 'calendario' : (screen as 'contatos' | 'projetos' | 'series' | 'comercial' | 'apresentacao' | 'usuarios')} onNavigate={navegar} />

      <div className="min-w-0 flex-1">
        {/* Cabeçalho de página padrão */}
        <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-canvas)_88%,transparent)] backdrop-blur">
          <div className="px-[var(--spacing-16)] py-[var(--spacing-12)] md:px-[var(--spacing-24)]">
            <div className="flex flex-wrap items-center gap-3 pl-12 md:pl-0">
              <h1 className="text-[length:var(--text-heading)]">{TITULO_PAGINA[screen]}</h1>
              <SaveIndicator status={store.saveStatus} />

              {isCalendar && (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="counter">
                    <strong className={contadores.atrasadas ? 'text-[var(--color-overdue)]' : ''}>{contadores.atrasadas}</strong> atrasadas
                  </span>
                  <span className="counter">
                    <strong>{contadores.vencendo}</strong> vencendo
                  </span>
                  <span className="counter">
                    <strong>{contadores.aguardando}</strong> aguardando
                  </span>
                  <span className="counter">
                    mês <strong>{contadores.concluidas}/{contadores.total}</strong>
                  </span>
                </div>
              )}

              {isCalendar && (
                <button className="btn-primary" onClick={() => setFormOpen(true)}>
                  + Nova obrigação
                </button>
              )}
            </div>

            {isCalendar && (
              <div className="mt-[var(--spacing-12)] flex flex-wrap items-center gap-3">
                <div className="segmented">
                  {VIEW_TABS.map((t) => (
                    <button key={t.id} className="seg-btn" data-active={screen === t.id} onClick={() => trocarView(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button className="btn-ghost" onClick={() => shift(-1)} aria-label="Anterior">‹</button>
                  <span className="min-w-[150px] text-center font-medium text-[var(--color-ink)]">{periodoLabel}</span>
                  <button className="btn-ghost" onClick={() => shift(1)} aria-label="Próximo">›</button>
                  <button className="btn-ghost" onClick={() => setCursorISO(todayISO())}>Hoje</button>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <select className="select w-auto" value={filtros.projeto} onChange={(e) => setFiltros((f) => ({ ...f, projeto: e.target.value }))}>
                    <option value="todos">Todos os projetos</option>
                    {store.state.projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <select className="select w-auto" value={filtros.escalista} onChange={(e) => setFiltros((f) => ({ ...f, escalista: e.target.value }))}>
                    <option value="todos">Todos os escalistas</option>
                    {escalistas.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className={`mx-auto px-[var(--spacing-16)] py-[var(--spacing-20)] md:px-[var(--spacing-24)] ${screen === 'comercial' ? 'max-w-none' : 'max-w-[1200px]'}`}>
          {isCalendar && <OcultadasBar year={year} month={month} />}
          {screen === 'dia' && <DayView anchorISO={cursorISO} filtros={filtros} onSelect={setSelected} />}
          {screen === 'semana' && <WeekView anchorISO={cursorISO} filtros={filtros} onSelect={setSelected} />}
          {screen === 'mes' && <MonthView year={year} month={month} filtros={filtros} onSelect={setSelected} />}
          {screen === 'lista' && <ListView year={year} month={month} filtros={filtros} onSelect={setSelected} />}
          {screen === 'checklist' && <ChecklistView year={year} month={month} filtros={filtros} onSelect={setSelected} />}
          {screen === 'contatos' && <ContatosPage />}
          {screen === 'projetos' && <AdminGuard><ProjectsAdmin /></AdminGuard>}
          {screen === 'series' && <AdminGuard><SeriesAdmin /></AdminGuard>}
          {screen === 'comercial' && (isGestor ? <ComercialPage /> : <p className="text-[var(--color-ink-soft)]">Área exclusiva do gestor.</p>)}
          {screen === 'apresentacao' && (isGestor ? <ApresentacaoPage /> : <p className="text-[var(--color-ink-soft)]">Área exclusiva do gestor.</p>)}
          {screen === 'usuarios' && <AdminGuard><UsersAdmin /></AdminGuard>}
        </main>
      </div>

      {selected && <ObligationDetail ro={selected} onClose={() => setSelected(null)} />}
      {formOpen && <ManualForm onClose={() => setFormOpen(false)} />}
    </div>
  );
}

function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  const [visivel, setVisivel] = useState(true);
  useSavedFade(status, setVisivel);
  if (status === 'idle' || (status === 'saved' && !visivel)) return null;
  const txt = status === 'saving' ? 'Salvando…' : status === 'saved' ? 'Salvo' : 'Erro ao salvar';
  const cor = status === 'error' ? 'text-[var(--color-overdue)]' : 'text-[var(--color-ink-faint)]';
  return <span className={`text-[length:var(--text-caption)] ${cor}`}>{txt}</span>;
}

// "Salvo" some sozinho após 2s; "Salvando…/Erro" permanecem.
function useSavedFade(status: string, setVisivel: (v: boolean) => void) {
  useEffect(() => {
    if (status === 'saved') {
      setVisivel(true);
      const t = setTimeout(() => setVisivel(false), 2000);
      return () => clearTimeout(t);
    }
    setVisivel(true);
  }, [status]);
}
