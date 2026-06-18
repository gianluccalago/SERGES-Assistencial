import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Contrato, Edital } from './model';
import { contratoDeEdital, editalDeRenovacao } from './model';
import { Syncer, type Slice, type SaveStatus } from '../lib/sync';
import { supabaseConfigured } from '../lib/supabase';

// Estado do módulo comercial, agora persistido no Supabase (tabelas editais,
// contratos e comercial_config). Mantém a API e o formato anteriores; só a
// camada de dados mudou. Migra automaticamente o localStorage na primeira carga.

const LEGACY_KEY = 'serges.comercial.v1';

interface ComercialState {
  editais: Edital[];
  contratos: Contrato[];
  janelaRenovacaoDias: number;
}

function defaultState(): ComercialState {
  return { editais: [], contratos: [], janelaRenovacaoDias: 90 };
}

function loadLegacy(): ComercialState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

const SLICES: Slice<ComercialState>[] = [
  {
    table: 'editais',
    extract: (s) => s.editais.map((e) => ({ key: e.id, row: { id: e.id, data: e } })),
    apply: (b, rows) => ({ ...b, editais: rows.map((r) => r.data as Edital) }),
  },
  {
    table: 'contratos',
    extract: (s) => s.contratos.map((c) => ({ key: c.id, row: { id: c.id, data: c } })),
    apply: (b, rows) => ({ ...b, contratos: rows.map((r) => r.data as Contrato) }),
  },
  {
    table: 'comercial_config',
    extract: (s) => [{ key: '1', row: { id: 1, data: { janelaRenovacaoDias: s.janelaRenovacaoDias } } }],
    apply: (b, rows) =>
      rows.length ? { ...b, janelaRenovacaoDias: (rows[0].data as { janelaRenovacaoDias: number }).janelaRenovacaoDias ?? 90 } : b,
  },
];

interface ComercialApi {
  state: ComercialState;
  saveStatus: SaveStatus;
  upsertEdital: (e: Edital) => void;
  removeEdital: (id: string) => void;
  upsertContrato: (c: Contrato) => void;
  removeContrato: (id: string) => void;
  setJanela: (dias: number) => void;
  /** Move o edital para Ativos e gera/ativa o contrato correspondente. */
  ganharEdital: (e: Edital) => void;
  /** Cria um edital de renovação na Triagem a partir de um contrato. */
  criarRenovacao: (c: Contrato) => void;
}

const Ctx = createContext<ComercialApi | null>(null);

export function ComercialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComercialState>(() => (supabaseConfigured ? defaultState() : loadLegacy() ?? defaultState()));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const syncerRef = useRef<Syncer<ComercialState>>();
  if (!syncerRef.current) syncerRef.current = new Syncer<ComercialState>(SLICES, defaultState);
  const syncer = syncerRef.current;
  const loadedRef = useRef(!supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelado = false;
    (async () => {
      try {
        const { state: loaded, hadRows } = await syncer.load();
        if (cancelado) return;
        if (!hadRows) {
          const legacy = loadLegacy();
          if (legacy) {
            setState(legacy);
            loadedRef.current = true;
            await syncer.push(legacy, setSaveStatus);
          } else {
            loadedRef.current = true;
          }
        } else {
          setState(loaded);
          loadedRef.current = true;
        }
      } catch (e) {
        console.error('[comercial] falha ao carregar', e);
        loadedRef.current = true;
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const reload = async () => {
    const { state: loaded } = await syncer.load();
    setState((prev) => (JSON.stringify(prev) === JSON.stringify(loaded) ? prev : loaded));
  };

  useEffect(() => {
    if (!supabaseConfigured || !loadedRef.current) return;
    syncer.push(state, setSaveStatus).catch(() => {
      void reload();
    });
  }, [state]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    return syncer.subscribe(() => {
      void reload().catch(() => {});
    });
  }, []);

  const api = useMemo<ComercialApi>(
    () => ({
      state,
      saveStatus,
      upsertEdital(e) {
        setState((s) => {
          const i = s.editais.findIndex((x) => x.id === e.id);
          const editais = [...s.editais];
          if (i >= 0) editais[i] = e;
          else editais.unshift(e);
          return { ...s, editais };
        });
      },
      removeEdital(id) {
        setState((s) => ({ ...s, editais: s.editais.filter((x) => x.id !== id) }));
      },
      upsertContrato(c) {
        setState((s) => {
          const i = s.contratos.findIndex((x) => x.id === c.id);
          const contratos = [...s.contratos];
          if (i >= 0) contratos[i] = c;
          else contratos.unshift(c);
          return { ...s, contratos };
        });
      },
      removeContrato(id) {
        setState((s) => ({ ...s, contratos: s.contratos.filter((x) => x.id !== id) }));
      },
      setJanela(dias) {
        setState((s) => ({ ...s, janelaRenovacaoDias: dias }));
      },
      ganharEdital(e) {
        setState((s) => {
          // Reativa contrato existente do mesmo edital, ou cria um novo.
          const existente = s.contratos.find((c) => c.editalId === e.id);
          const contratos = existente
            ? s.contratos.map((c) => (c.id === existente.id ? { ...c, status: 'ativo' as const } : c))
            : [contratoDeEdital(e), ...s.contratos];
          const contratoId = existente ? existente.id : contratos[0].id;
          const editais = s.editais.map((x) => (x.id === e.id ? { ...x, fase: 'ativo' as const, contratoId } : x));
          return { ...s, editais, contratos };
        });
      },
      criarRenovacao(c) {
        setState((s) => ({ ...s, editais: [editalDeRenovacao(c), ...s.editais] }));
      },
    }),
    [state, saveStatus],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useComercial(): ComercialApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useComercial deve ser usado dentro de ComercialProvider');
  return ctx;
}
