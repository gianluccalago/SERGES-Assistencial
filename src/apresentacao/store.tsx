import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Competencia, OrcamentoAno } from './model';
import { Syncer, type Slice, type SaveStatus } from '../lib/sync';
import { supabaseConfigured } from '../lib/supabase';

// Estado e persistência próprios do módulo Apresentação de Resultados.
// Cada competência é uma linha jsonb na tabela apr_competencias.

const LEGACY_KEY = 'serges.apresentacao.v1';

interface AprState {
  competencias: Competencia[];
  orcamentos: OrcamentoAno[];
}

function defaultState(): AprState {
  return { competencias: [], orcamentos: [] };
}

function loadLegacy(): AprState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

const SLICES: Slice<AprState>[] = [
  {
    table: 'apr_competencias',
    extract: (s) => s.competencias.map((c) => ({ key: c.id, row: { id: c.id, data: c } })),
    apply: (b, rows) => ({ ...b, competencias: rows.map((r) => r.data as Competencia) }),
  },
  {
    table: 'apr_orcamento',
    extract: (s) => s.orcamentos.map((o) => ({ key: String(o.ano), row: { id: String(o.ano), data: o } })),
    apply: (b, rows) => ({ ...b, orcamentos: rows.map((r) => r.data as OrcamentoAno) }),
  },
];

interface AprApi {
  state: AprState;
  saveStatus: SaveStatus;
  upsert: (c: Competencia) => void;
  remove: (id: string) => void;
  orcamentoDoAno: (ano: number) => OrcamentoAno | undefined;
}

const Ctx = createContext<AprApi | null>(null);

export function ApresentacaoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AprState>(() => (supabaseConfigured ? defaultState() : loadLegacy() ?? defaultState()));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const syncerRef = useRef<Syncer<AprState>>();
  if (!syncerRef.current) syncerRef.current = new Syncer<AprState>(SLICES, defaultState);
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
        console.error('[apresentacao] falha ao carregar', e);
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

  const api = useMemo<AprApi>(
    () => ({
      state,
      saveStatus,
      upsert(c) {
        setState((s) => {
          const i = s.competencias.findIndex((x) => x.id === c.id);
          const competencias = [...s.competencias];
          if (i >= 0) competencias[i] = c;
          else competencias.unshift(c);
          return { ...s, competencias };
        });
      },
      remove(id) {
        setState((s) => ({ ...s, competencias: s.competencias.filter((x) => x.id !== id) }));
      },
      orcamentoDoAno(ano) {
        return state.orcamentos.find((o) => o.ano === ano);
      },
    }),
    [state, saveStatus],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApresentacao(): AprApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApresentacao deve ser usado dentro de ApresentacaoProvider');
  return ctx;
}
