import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Contrato, Edital } from './model';
import { contratoDeEdital, editalDeRenovacao } from './model';

// Estado e persistência PRÓPRIOS do módulo comercial (localStorage à parte).
// Não toca em obrigações, calendário ou contatos operacionais.

const KEY = 'serges.comercial.v1';

interface ComercialState {
  editais: Edital[];
  contratos: Contrato[];
  janelaRenovacaoDias: number;
}

function defaultState(): ComercialState {
  return { editais: [], contratos: [], janelaRenovacaoDias: 90 };
}

function load(): ComercialState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

interface ComercialApi {
  state: ComercialState;
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
  const [state, setState] = useState<ComercialState>(() => load());
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state]);

  const api = useMemo<ComercialApi>(
    () => ({
      state,
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
    [state],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useComercial(): ComercialApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useComercial deve ser usado dentro de ComercialProvider');
  return ctx;
}
