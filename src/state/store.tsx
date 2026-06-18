import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { proximaCompetencia, textoRecuperacao } from '../domain/workflows';
import type { ResolucaoMes } from '../domain/types';
import {
  loadState,
  defaultState,
  loadConfig,
  defaultConfig,
  type PersistedState,
} from './persistence';
import { assembleMonth } from '../domain/resolve';
import { deriveObligations } from '../domain/engine';
import { buildHolidaySet } from '../domain/holidays';
import { Syncer, type Slice, type SaveStatus } from '../lib/sync';
import { supabaseConfigured } from '../lib/supabase';

// Estado combinado (estado + config) usado pelo motor de sync.
type FullState = PersistedState & { config: AppConfig };

function emptyFull(): FullState {
  return { version: 0, projects: [], extraHolidays: [], overrides: {}, manualObligations: [], contatos: [], config: defaultConfig() };
}

// Mapeamento estado <-> tabelas Postgres (uma linha jsonb por entidade).
const SLICES: Slice<FullState>[] = [
  {
    table: 'projects',
    extract: (s) => s.projects.map((p) => ({ key: p.id, row: { id: p.id, data: p } })),
    apply: (b, rows) => ({ ...b, projects: rows.map((r) => r.data as Project) }),
  },
  {
    table: 'holidays',
    pk: 'date',
    extract: (s) => s.extraHolidays.map((h) => ({ key: h.date, row: { date: h.date, data: h } })),
    apply: (b, rows) => ({ ...b, extraHolidays: rows.map((r) => r.data as Holiday) }),
  },
  {
    table: 'overrides',
    extract: (s) => Object.entries(s.overrides).map(([id, ov]) => ({ key: id, row: { id, data: ov } })),
    apply: (b, rows) => ({ ...b, overrides: Object.fromEntries(rows.map((r) => [String(r.id), r.data as Override])) }),
  },
  {
    table: 'manual_obligations',
    extract: (s) => s.manualObligations.map((m) => ({ key: m.id, row: { id: m.id, data: m } })),
    apply: (b, rows) => ({ ...b, manualObligations: rows.map((r) => r.data as ManualObligation) }),
  },
  {
    table: 'contatos',
    extract: (s) => s.contatos.map((c) => ({ key: c.id, row: { id: c.id, data: c } })),
    apply: (b, rows) => ({ ...b, contatos: rows.map((r) => r.data as Contato) }),
  },
  {
    table: 'app_config',
    extract: (s) => [{ key: '1', row: { id: 1, data: s.config } }],
    apply: (b, rows) => (rows.length ? { ...b, config: rows[0].data as AppConfig } : b),
  },
];

interface AppStore {
  state: PersistedState;
  config: AppConfig;
  /** Estado de gravação no Supabase (para o indicador salvando/salvo). */
  saveStatus: SaveStatus;
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
  // Editar campos de uma obrigação (gerada -> override; manual -> registro).
  editItem: (
    item: CalendarItem,
    patch: { titulo?: string; responsavel?: string; projetoId?: string; prazo?: string; notas?: string },
  ) => void;
  // Contatos (§6.5)
  upsertContato: (c: Contato) => void;
  removeContato: (id: string) => void;
  contatosDoProjeto: (projetoId?: string) => Contato[];
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
  // Sem Supabase configurado, opera offline a partir do localStorage (fallback).
  const [state, setState] = useState<PersistedState>(() =>
    supabaseConfigured ? { version: 0, projects: [], extraHolidays: [], overrides: {}, manualObligations: [], contatos: [] } : loadState(),
  );
  const [config, setConfigState] = useState<AppConfig>(() => loadConfig());
  const [ready, setReady] = useState(!supabaseConfigured);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const syncerRef = useRef<Syncer<FullState>>();
  if (!syncerRef.current) syncerRef.current = new Syncer<FullState>(SLICES, emptyFull);
  const syncer = syncerRef.current;
  const loadedRef = useRef(!supabaseConfigured);

  // Carga inicial do Supabase + migração única do localStorage (sem perda).
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelado = false;
    (async () => {
      try {
        const { state: loaded, hadRows } = await syncer.load();
        if (cancelado) return;
        if (!hadRows) {
          // Banco vazio: importa o que houver no localStorage (ou os seeds).
          const local = loadState();
          const localCfg = loadConfig();
          setState(local);
          setConfigState(localCfg);
          loadedRef.current = true;
          setReady(true);
          try {
            await syncer.push({ ...local, config: localCfg }, setSaveStatus);
            localStorage.setItem('serges.migrado.supabase', new Date().toISOString());
          } catch (e) {
            // Migração parcial (ex.: projetos/feriados exigem gestor). Não derruba o app.
            console.error('[migração] alguns dados não foram importados', e);
          }
        } else {
          const { config: cfg, ...rest } = loaded;
          setState(rest);
          setConfigState(cfg);
          loadedRef.current = true;
          setReady(true);
        }
      } catch (e) {
        if (!cancelado) setErroCarga(e instanceof Error ? e.message : 'Falha ao carregar dados.');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const reload = async () => {
    const { state: loaded } = await syncer.load();
    const { config: cfg, ...rest } = loaded;
    // Só re-renderiza se algo realmente mudou (evita "piscar" no eco do realtime).
    setState((prev) => (JSON.stringify(prev) === JSON.stringify(rest) ? prev : (rest as PersistedState)));
    setConfigState((prev) => (JSON.stringify(prev) === JSON.stringify(cfg) ? prev : cfg));
  };

  // Persiste no Supabase a cada mudança (otimista; diff calcula o que mudou).
  // Se o banco rejeitar (ex.: gate de papel no RLS), recarrega para reverter.
  useEffect(() => {
    if (!supabaseConfigured || !loadedRef.current) return;
    syncer.push({ ...state, config }, setSaveStatus).catch(() => {
      void reload();
    });
  }, [state, config]);

  // Realtime: recarrega quando outro usuário altera algo.
  useEffect(() => {
    if (!supabaseConfigured) return;
    return syncer.subscribe(() => {
      void reload().catch(() => {});
    });
  }, []);

  const store = useMemo<AppStore>(() => {
    const patchOverride = (id: string, patch: Partial<Override>) =>
      setState((s) => ({
        ...s,
        overrides: { ...s.overrides, [id]: { ...s.overrides[id], ...patch } },
      }));

    return {
      state,
      config,
      saveStatus,
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
        const marcaPatch = {
          ...(estado === 'concluida' ? { markedAt: new Date().toISOString(), markedBy: marca?.por } : {}),
          // Ao entrar "Em aprovação do Gestor", inicia o timer de 24h.
          ...(estado === 'emAprovacao' ? { enviadaAprovacaoEm: new Date().toISOString() } : {}),
        };
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
  }, [state, config, saveStatus]);

  if (erroCarga) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="mb-2 font-medium text-[var(--color-overdue)]">Falha ao carregar os dados</p>
          <p className="text-[length:var(--text-label)] text-[var(--color-ink-soft)]">{erroCarga}</p>
        </div>
      </div>
    );
  }
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-[var(--color-ink-soft)]">Carregando…</div>;
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore deve ser usado dentro de StoreProvider');
  return ctx;
}
