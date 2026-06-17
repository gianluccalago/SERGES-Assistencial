import type {
  Project,
  Override,
  Holiday,
  ManualObligation,
  AppConfig,
  Contato,
  ObligationEstado,
} from '../domain/types';
import { seedProjects } from '../data/projects';
import { seedExtraHolidays } from '../data/holidays';
import { seedContatos } from '../data/contatos';

/** Mapeia status antigos (modelo de 6 estados) para os 4 atuais (§4.5). */
function migrarEstado(e: unknown): ObligationEstado | undefined {
  switch (e) {
    case 'pendente':
    case 'concluida':
      return e;
    case 'aguardandoRetorno':
      return 'aguardandoInput';
    case 'aguardandoInput':
    case 'emAprovacao':
      return e;
    case 'emCobranca':
    case 'escalada':
    case 'atrasada':
      return 'pendente';
    default:
      return undefined;
  }
}

const CONFIG_KEY = 'serges.config';

export const DEFAULT_ORACULO_URL =
  'https://notebooklm.google.com/notebook/ee50a784-7239-4b3a-a7d3-a4fb591616c1';

export function defaultConfig(): AppConfig {
  return { oraculoUrl: DEFAULT_ORACULO_URL };
}

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig();
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

// Persistência local versionada. Guarda três coisas: a configuração dos
// projetos, os overrides sobre obrigações geradas e as obrigações manuais.

const STORAGE_KEY = 'serges.obrigacoes';
const SCHEMA_VERSION = 3;

export interface PersistedState {
  version: number;
  projects: Project[];
  extraHolidays: Holiday[];
  /** Ajustes manuais sobre obrigações geradas, indexados pelo id estável. */
  overrides: Record<string, Override>;
  /** Obrigações criadas do zero pelo usuário. */
  manualObligations: ManualObligation[];
  /** Contatos operacionais (§6.5), fonte única. */
  contatos: Contato[];
}

export function defaultState(): PersistedState {
  return {
    version: SCHEMA_VERSION,
    projects: structuredClone(seedProjects),
    extraHolidays: structuredClone(seedExtraHolidays),
    overrides: {},
    manualObligations: [],
    contatos: structuredClone(seedContatos),
  };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Tenta migrar o schema v1 antigo, se existir.
      return migrate(readLegacyV1());
    }
    return migrate(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Armazenamento indisponível: ignora.
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readLegacyV1(): any {
  try {
    const raw = localStorage.getItem('serges.obrigacoes.v1');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Migra qualquer estado anterior para o schema atual. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(state: any): PersistedState {
  const base = defaultState();
  if (!state || typeof state !== 'object') return base;

  // v1: obligationStates (anexoPlanilha/observacao) + eventos.
  const overrides: Record<string, Override> = state.overrides ?? {};
  if (!state.overrides && state.obligationStates) {
    for (const [id, us] of Object.entries<Record<string, unknown>>(state.obligationStates)) {
      overrides[id] = {
        estado: us.estado as Override['estado'],
        dataNova: us.prazoManual as string | undefined,
        anexoPresente: us.anexoPlanilha as boolean | undefined,
        notas: us.observacao as string | undefined,
        enviadaAprovacaoEm: us.enviadaAprovacaoEm as string | undefined,
        retornoRecebidoEm: us.retornoRecebidoEm as string | undefined,
      };
    }
  }

  const manualObligations: ManualObligation[] = state.manualObligations ?? [];
  if (!state.manualObligations && Array.isArray(state.eventos)) {
    for (const e of state.eventos) {
      manualObligations.push({
        id: e.id,
        titulo: e.titulo,
        data: e.prazoCalculado,
        tipo: 'evento',
        projetoId: e.projetoId,
        responsavel: e.responsavel,
        notas: e.regraOrigem,
        estado: 'pendente',
        critico: e.critico,
      });
    }
  }

  // Renomeia ids antigos cardPagamento: -> lotePagamento: (§4.3).
  for (const id of Object.keys(overrides)) {
    if (id.startsWith('cardPagamento:')) {
      const novo = id.replace(/^cardPagamento:/, 'lotePagamento:');
      overrides[novo] = { ...overrides[novo], ...overrides[id] };
      delete overrides[id];
    }
  }

  // Normaliza status antigos para o modelo de 4 status (§4.5).
  for (const ov of Object.values(overrides)) {
    if (ov.estado) ov.estado = migrarEstado(ov.estado);
  }
  for (const m of manualObligations) {
    m.estado = migrarEstado(m.estado) ?? 'pendente';
  }

  return {
    version: SCHEMA_VERSION,
    projects: state.projects ?? base.projects,
    extraHolidays: state.extraHolidays ?? base.extraHolidays,
    overrides,
    manualObligations,
    contatos: state.contatos ?? base.contatos,
  };
}
