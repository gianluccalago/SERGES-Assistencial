import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Project, ObligationUserState, Holiday, Obligation } from '../domain/types';
import { loadState, saveState, defaultState, type PersistedState, type PersistedEvento } from './persistence';
import { deriveObligations } from '../domain/engine';
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
  // Estado de obrigações
  updateObligationState: (id: string, patch: Partial<ObligationUserState>) => void;
  getObligationState: (id: string) => ObligationUserState | undefined;
  // Eventos avulsos
  addEvento: (evento: PersistedEvento) => void;
  removeEvento: (id: string) => void;
  // Derivação
  obligationsFor: (year: number, month: number) => Obligation[];
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
      updateObligationState(id, patch) {
        setState((s) => ({
          ...s,
          obligationStates: {
            ...s.obligationStates,
            [id]: { ...s.obligationStates[id], ...patch },
          },
        }));
      },
      getObligationState(id) {
        return state.obligationStates[id];
      },
      addEvento(evento) {
        setState((s) => ({ ...s, eventos: [...s.eventos.filter((e) => e.id !== evento.id), evento] }));
      },
      removeEvento(id) {
        setState((s) => ({ ...s, eventos: s.eventos.filter((e) => e.id !== id) }));
      },
      holidaySetFor(years) {
        return buildHolidaySet(years, state.extraHolidays);
      },
      obligationsFor(year, month) {
        const holidays = buildHolidaySet([year - 1, year, year + 1], state.extraHolidays);
        const derived = deriveObligations(year, month, state.projects, holidays);
        const comp = `${year}-${String(month).padStart(2, '0')}`;
        const eventos: Obligation[] = state.eventos
          .filter((e) => e.prazoCalculado.startsWith(comp))
          .map((e) => ({
            id: e.id,
            titulo: e.titulo,
            projetoId: e.projetoId,
            tipo: 'evento',
            regraOrigem: e.regraOrigem,
            competencia: comp,
            prazoCalculado: e.prazoCalculado,
            estado: 'pendente',
            responsavel: e.responsavel,
            critico: e.critico,
          }));
        return [...derived, ...eventos];
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
