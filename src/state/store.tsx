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
  AppConfig,
  ObligationEstado,
  Contato,
} from '../domain/types';
import { registrarCobranca } from '../domain/stateMachine';
import { proximaCompetencia, textoRecuperacao } from '../domain/workflows';
import type { MedicoCard, ResolucaoMes } from '../domain/types';
import {
  loadState,
  saveState,
  defaultState,
  loadConfig,
  saveConfig,
  type PersistedState,
} from './persistence';
import { assembleMonth } from '../domain/resolve';
import { deriveObligations } from '../domain/engine';
import { buildHolidaySet } from '../domain/holidays';

interface AppStore {
  state: PersistedState;
  config: AppConfig;
  setConfig: (patch: Partial<AppConfig>) => void;
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
  // Estado (gerada -> override.estado; manual -> registro), com trilha de repasse
  setEstado: (item: CalendarItem, estado: ObligationEstado, marca?: { por?: string }) => void;
  batchMark: (items: CalendarItem[], estado: ObligationEstado, por?: string) => void;
  // Ações (§4.5): cobrar (log) e escalar (protocolo), sem mudar status.
  cobrar: (item: CalendarItem) => void;
  escalar: (item: CalendarItem) => void;
  // Editar campos de uma obrigação (gerada -> override; manual -> registro).
  editItem: (
    item: CalendarItem,
    patch: { titulo?: string; responsavel?: string; projetoId?: string; prazo?: string; notas?: string },
  ) => void;
  // Contatos (§6.5)
  upsertContato: (c: Contato) => void;
  removeContato: (id: string) => void;
  contatosDoProjeto: (projetoId?: string) => Contato[];
  // Lote de pagamento — cards de médico (§4.3)
  setMedicos: (loteId: string, medicos: MedicoCard[]) => void;
  // Resoluções de mês (§4.5)
  setResolucaoMes: (item: CalendarItem, resolucao: ResolucaoMes | undefined) => void;
  faturadoParcialmente: (item: CalendarItem, valorFaltante: number) => void;
  // Derivação
  itemsFor: (year: number, month: number) => CalendarItem[];
  dismissedFor: (year: number, month: number) => string[];
  dismissedItemsFor: (year: number, month: number) => { id: string; titulo: string }[];
  holidaySetFor: (years: number[]) => Set<string>;
  resetAll: () => void;
}

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [config, setConfigState] = useState<AppConfig>(() => loadConfig());

  useEffect(() => {
    saveState(state);
  }, [state]);
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const store = useMemo<AppStore>(() => {
    const patchOverride = (id: string, patch: Partial<Override>) =>
      setState((s) => ({
        ...s,
        overrides: { ...s.overrides, [id]: { ...s.overrides[id], ...patch } },
      }));

    return {
      state,
      config,
      setConfig(patch) {
        setConfigState((c) => ({ ...c, ...patch }));
      },
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
      setEstado(item, estado, marca) {
        const marcaPatch =
          estado === 'concluida'
            ? { markedAt: new Date().toISOString(), markedBy: marca?.por }
            : {};
        if (item.isManual) {
          setState((s) => ({
            ...s,
            manualObligations: s.manualObligations.map((x) =>
              x.id === item.id ? { ...x, estado, ...marcaPatch } : x,
            ),
          }));
        } else {
          patchOverride(item.id, { estado, ...marcaPatch });
        }
      },
      batchMark(items, estado, por) {
        const markedAt = new Date().toISOString();
        setState((s) => {
          const overrides = { ...s.overrides };
          let manuais = s.manualObligations;
          for (const item of items) {
            if (item.isManual) {
              manuais = manuais.map((x) =>
                x.id === item.id ? { ...x, estado, markedAt, markedBy: por } : x,
              );
            } else {
              overrides[item.id] = { ...overrides[item.id], estado, markedAt, markedBy: por };
            }
          }
          return { ...s, overrides, manualObligations: manuais };
        });
      },
      cobrar(item) {
        const agora = new Date().toISOString();
        if (item.isManual) {
          setState((s) => ({
            ...s,
            manualObligations: s.manualObligations.map((x) =>
              x.id === item.id ? { ...x, cobrancas: registrarCobranca(x.cobrancas, agora) } : x,
            ),
          }));
        } else {
          patchOverride(item.id, { cobrancas: registrarCobranca(state.overrides[item.id]?.cobrancas, agora) });
        }
      },
      escalar(item) {
        const agora = new Date().toISOString();
        if (item.isManual) {
          setState((s) => ({
            ...s,
            manualObligations: s.manualObligations.map((x) =>
              x.id === item.id ? { ...x, escaladoEm: agora } : x,
            ),
          }));
        } else {
          patchOverride(item.id, { escaladoEm: agora });
        }
      },
      editItem(item, patch) {
        if (item.isManual) {
          setState((s) => ({
            ...s,
            manualObligations: s.manualObligations.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    titulo: patch.titulo ?? x.titulo,
                    responsavel: patch.responsavel,
                    projetoId: patch.projetoId,
                    data: patch.prazo ?? x.data,
                    notas: patch.notas,
                  }
                : x,
            ),
          }));
        } else {
          patchOverride(item.id, {
            titulo: patch.titulo,
            responsavel: patch.responsavel,
            projetoId: patch.projetoId,
            dataNova: patch.prazo,
            notas: patch.notas,
          });
        }
      },
      upsertContato(c) {
        setState((s) => {
          const idx = s.contatos.findIndex((x) => x.id === c.id);
          const contatos = [...s.contatos];
          if (idx >= 0) contatos[idx] = c;
          else contatos.push(c);
          return { ...s, contatos };
        });
      },
      removeContato(id) {
        setState((s) => ({ ...s, contatos: s.contatos.filter((x) => x.id !== id) }));
      },
      contatosDoProjeto(projetoId) {
        if (!projetoId) return [];
        return state.contatos.filter((c) => c.projetos.includes(projetoId));
      },
      setMedicos(loteId, medicos) {
        patchOverride(loteId, { medicos });
      },
      setResolucaoMes(item, resolucao) {
        // Resoluções de mês aplicam-se a obrigações geradas (lote/faturamento).
        patchOverride(item.id, { resolucaoMes: resolucao });
      },
      faturadoParcialmente(item, valorFaltante) {
        // Conclui o faturamento do mês com a marca de faturado parcialmente.
        patchOverride(item.id, {
          estado: 'concluida',
          resolucaoMes: 'faturadoParcialmente',
          valorFaltante,
          markedAt: new Date().toISOString(),
        });
        // Carrega a recuperação para o faturamento do mesmo projeto no mês seguinte.
        if (item.projetoId) {
          const proxComp = proximaCompetencia(item.competencia);
          const proxId = `faturamentoIniciar:${item.projetoId}:${proxComp}`;
          patchOverride(proxId, {
            recuperacao: { texto: textoRecuperacao(item.competencia), valor: valorFaltante },
          });
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
      dismissedItemsFor(year, month) {
        const holidays = buildHolidaySet([year - 1, year, year + 1], state.extraHolidays);
        const comp = `${year}-${String(month).padStart(2, '0')}`;
        return deriveObligations(year, month, state.projects, holidays)
          .filter((o) => state.overrides[o.id]?.dismissed && o.competencia === comp)
          .map((o) => ({ id: o.id, titulo: o.titulo }));
      },
      resetAll() {
        setState(defaultState());
      },
    };
  }, [state, config]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore deve ser usado dentro de StoreProvider');
  return ctx;
}
