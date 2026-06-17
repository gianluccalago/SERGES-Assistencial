import type { Project, ObligationUserState, Holiday } from '../domain/types';
import { seedProjects } from '../data/projects';
import { seedExtraHolidays } from '../data/holidays';

// Persistência local versionada. Sem backend nesta versão. O schema é
// versionado para permitir migrações futuras sem perder dados do usuário.

const STORAGE_KEY = 'serges.obrigacoes.v1';
const SCHEMA_VERSION = 1;

export interface PersistedState {
  version: number;
  projects: Project[];
  /** Feriados municipais/extras adicionados pelo usuário. */
  extraHolidays: Holiday[];
  /** Estado marcado pelo usuário, indexado pelo id estável da obrigação. */
  obligationStates: Record<string, ObligationUserState>;
  /** Eventos avulsos (tipo 'evento') criados pelo usuário. */
  eventos: PersistedEvento[];
}

export interface PersistedEvento {
  id: string;
  titulo: string;
  prazoCalculado: string;
  regraOrigem: string;
  projetoId?: string;
  responsavel?: string;
  critico?: boolean;
}

export function defaultState(): PersistedState {
  return {
    version: SCHEMA_VERSION,
    projects: structuredClone(seedProjects),
    extraHolidays: structuredClone(seedExtraHolidays),
    obligationStates: {},
    eventos: [],
  };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as PersistedState;
    return migrate(parsed);
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Armazenamento indisponível (modo privado etc.): ignora silenciosamente.
  }
}

/** Aplica migrações entre versões de schema. */
function migrate(state: PersistedState): PersistedState {
  const base = defaultState();
  if (!state || typeof state !== 'object') return base;
  return {
    version: SCHEMA_VERSION,
    projects: state.projects ?? base.projects,
    extraHolidays: state.extraHolidays ?? base.extraHolidays,
    obligationStates: state.obligationStates ?? {},
    eventos: state.eventos ?? [],
  };
}
