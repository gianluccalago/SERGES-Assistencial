import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Project,
  Override,
  Holiday,
  ManualObligation,
  CalendarItem,
} from '../domain/types';
import { loadState, saveState, defaultState, type PersistedState } from './persistence';
import { assembleMonth } from '../domain/resolve';
import { buildHolidaySet } from '../domain/holidays';

interface AppStore {
  state: PersistedState;
  // Projetos
  upsertProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setProjectAtivo: (id: string, ativo: boolean) => void;
  // Feriados
  addHoliday: (holiday: Holiday) => void;
  removeHoliday: (date: string) => void;
  // Overrides sobre obrigações geradas
  patchOverride: (id: string, patch: Partial<Override>) => void;
  getOverride: (id: string) => Override | undefined;
  dismiss: (id: string) => void;
  undismiss: (id: string) => void;
  // Obrigações manuais
  addManual: (m: ManualObligation) => void;
  updateManual: (m: ManualObligation) => void;
  removeManual: (id: string) => void;
  // Mover (gerada -> override.dataNova; manual -> altera data)
  moveItem: (item: CalendarItem, novaData: string) => void;
  // Excluir (gerada -> dismissed; manual -> remove)
  deleteItem: (item: CalendarItem) => void;
  // Derivação
  itemsFor: (year: number, month: number) => CalendarItem[];
  dismissedFor: (year: number, month: number) => string[];
  holidaySetFor: (years: number[]) => Set<string>;
  resetAll: () => void;
}

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const store = useMemo<AppStore>(() => {
    const patchOverride = (id: string, patch: Partial<Override>) =>
      setState((s) => ({
        ...s,
        overrides: { ...s.overrides, [id]: { ...s.overrides[id], ...patch } },
      }));

    return {
      state,
      upsertProject(project) {
        setState((s) => {
          const idx = s.projects.findIndex((p) => p.id === project.id);
          const projects = [...s.projects];
          if (idx >= 0) projects[idx] = project;
          else projects.push(project);
          return { ...s, projects };
        });
      },
      removeProject(id) {
        setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }));
      },
      setProjectAtivo(id, ativo) {
        setState((s) => ({
          ...s,
          projects: s.projects.map((p) => (p.id === id ? { ...p, ativo } : p)),
        }));
      },
      addHoliday(holiday) {
        setState((s) => ({
          ...s,
          extraHolidays: [...s.extraHolidays.filter((h) => h.date !== holiday.date), holiday],
        }));
      },
      removeHoliday(date) {
        setState((s) => ({ ...s, extraHolidays: s.extraHolidays.filter((h) => h.date !== date) }));
      },
      patchOverride,
      getOverride(id) {
        return state.overrides[id];
      },
      dismiss(id) {
        patchOverride(id, { dismissed: true });
      },
      undismiss(id) {
        patchOverride(id, { dismissed: false });
      },
      addManual(m) {
        setState((s) => ({ ...s, manualObligations: [...s.manualObligations, m] }));
      },
      updateManual(m) {
        setState((s) => ({
          ...s,
          manualObligations: s.manualObligations.map((x) => (x.id === m.id ? m : x)),
        }));
      },
      removeManual(id) {
        setState((s) => ({
          ...s,
          manualObligations: s.manualObligations.filter((x) => x.id !== id),
        }));
      },
      moveItem(item, novaData) {
        if (item.isManual) {
          setState((s) => ({
            ...s,
            manualObligations: s.manualObligations.map((x) =>
              x.id === item.id ? { ...x, data: novaData } : x,
            ),
          }));
        } else {
          patchOverride(item.id, { dataNova: novaData });
        }
      },
      deleteItem(item) {
        if (item.isManual) {
          setState((s) => ({
            ...s,
            manualObligations: s.manualObligations.filter((x) => x.id !== item.id),
          }));
        } else {
          patchOverride(item.id, { dismissed: true });
        }
      },
      holidaySetFor(years) {
        return buildHolidaySet(years, state.extraHolidays);
      },
      itemsFor(year, month) {
        const holidays = buildHolidaySet([year - 1, year, year + 1], state.extraHolidays);
        return assembleMonth(year, month, state.projects, holidays, state.overrides, state.manualObligations);
      },
      dismissedFor(year, month) {
        const comp = `${year}-${String(month).padStart(2, '0')}`;
        return Object.entries(state.overrides)
          .filter(([id, ov]) => ov.dismissed && id.endsWith(`:${comp}`))
          .map(([id]) => id);
      },
      resetAll() {
        setState(defaultState());
      },
    };
  }, [state]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore deve ser usado dentro de StoreProvider');
  return ctx;
}
