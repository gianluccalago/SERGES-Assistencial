// Módulo Setor Comercial Público — modelo e lógica pura. Isolado: não importa
// nada das obrigações e não cria nada no calendário.
import { addCalendarDays, fromISODate, toISODate } from '../domain/dateUtils';

export type Modalidade = 'online' | 'presencial' | 'ambos';
export type Periodicidade = 'diaria' | 'semanal' | 'quinzenal';
export type GrupoDoc = 'especificos' | 'gerais' | 'profissionais';

/** Fases do funil de editais. */
export type FaseEdital =
  | 'triagem'
  | 'decisao'
  | 'descartado'
  | 'reunir'
  | 'conferencia'
  | 'correcao'
  | 'envio'
  | 'enviado'
  | 'ativo'
  | 'perdido';

export type ContratoStatus = 'ativo' | 'inativo' | 'suspenso' | 'vencido';

/** Um anexo é OU um link externo (url) OU um arquivo no Storage (path+nome). */
export interface Anexo {
  id: string;
  rotulo: string;
  url?: string;
  /** Caminho no Supabase Storage, quando for upload real. */
  path?: string;
  /** Nome original do arquivo enviado. */
  nome?: string;
}

export interface ContatoPref {
  nome?: string;
  telefone?: string;
  email?: string;
}

export interface DocItem {
  id: string;
  grupo: GrupoDoc;
  nome: string;
  pronto?: boolean;
  url?: string;
  /** Caminho no Storage, quando o documento for um arquivo enviado. */
  path?: string;
  /** Nome original do arquivo enviado. */
  nomeArquivo?: string;
}

export interface Verificacao {
  id: string;
  data: string; // ISO
  obs: string;
}

export interface Edital {
  id: string;
  cidade: string;
  uf: string;
  tipoServico?: string;
  valor?: number;
  submissaoInicio?: string;
  submissaoFim?: string;
  modalidade?: Modalidade;
  linkEdital?: string;
  anexos: Anexo[];
  contato: ContatoPref;
  fase: FaseEdital;
  motivoDescarte?: string;
  motivoPerda?: string;
  checklist: DocItem[];
  comprovacao?: Anexo;
  // Acompanhamento dos enviados
  urlAcompanhamento?: string;
  periodicidade?: Periodicidade;
  dataPrevistaResultado?: string;
  proximaVerificacao?: string;
  verificacoes: Verificacao[];
  contratoId?: string;
  criadoEm: string;
}

export interface Contrato {
  id: string;
  cidade: string;
  uf: string;
  tipoServico?: string;
  valor?: number;
  inicio?: string;
  fimVencimento?: string;
  modalidade?: Modalidade;
  status: ContratoStatus;
  motivo?: string;
  contato: ContatoPref;
  linkEdital?: string;
  linkContrato?: string;
  anexos: Anexo[];
  editalId?: string;
}

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  online: 'Online',
  presencial: 'Presencial',
  ambos: 'Ambos',
};

export const PERIODICIDADE_LABEL: Record<Periodicidade, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
};

export const FASE_LABEL: Record<FaseEdital, string> = {
  triagem: 'Triagem',
  decisao: 'Decisão',
  descartado: 'Descartado',
  reunir: 'Reunir documentos',
  conferencia: 'Conferência documental',
  correcao: 'Correção',
  envio: 'Envio',
  enviado: 'Enviado',
  ativo: 'Ativo (ganho)',
  perdido: 'Perdido',
};

/** Ordem do funil para agrupar as colunas/listas. */
export const FASES_FUNIL: FaseEdital[] = [
  'triagem',
  'decisao',
  'reunir',
  'conferencia',
  'correcao',
  'envio',
  'enviado',
];

export const GRUPO_LABEL: Record<GrupoDoc, string> = {
  especificos: 'Específicos do edital',
  gerais: 'Gerais da empresa',
  profissionais: 'Dos profissionais',
};

const DIAS: Record<Periodicidade, number> = { diaria: 1, semanal: 7, quinzenal: 15 };

export function avancaVerificacao(baseISO: string, per: Periodicidade): string {
  return toISODate(addCalendarDays(fromISODate(baseISO), DIAS[per]));
}

export function diasAte(iso: string, hojeISO: string): number {
  return Math.round((fromISODate(iso).getTime() - fromISODate(hojeISO).getTime()) / 86400000);
}

/** Status de um prazo (submissão / vencimento) relativo a hoje. */
export function prazoStatus(iso: string | undefined, hojeISO: string, proximoEmDias = 3): 'vencido' | 'proximo' | 'ok' | 'sem' {
  if (!iso) return 'sem';
  const d = diasAte(iso, hojeISO);
  if (d < 0) return 'vencido';
  if (d <= proximoEmDias) return 'proximo';
  return 'ok';
}

/** Checklist-modelo pré-carregado ao entrar em "Reunir documentos". */
export function checklistModelo(): DocItem[] {
  const mk = (grupo: GrupoDoc, nomes: string[]): DocItem[] =>
    nomes.map((nome, i) => ({ id: `doc-${grupo}-${i}-${Math.random().toString(36).slice(2, 6)}`, grupo, nome }));
  return [
    ...mk('especificos', ['Anexo I', 'Anexo II', 'Anexo III']),
    ...mk('gerais', ['CND Federal', 'CND Estadual', 'FGTS (CRF)', 'GMS', 'Contrato social']),
    ...mk('profissionais', ['CRM', 'Vínculo', 'Comprovante de experiência']),
  ];
}

/** Cria um contrato a partir de um edital ganho, herdando os dados. */
export function contratoDeEdital(e: Edital): Contrato {
  return {
    id: `ct-${crypto.randomUUID().slice(0, 8)}`,
    cidade: e.cidade,
    uf: e.uf,
    tipoServico: e.tipoServico,
    valor: e.valor,
    inicio: toISODate(new Date()),
    modalidade: e.modalidade,
    status: 'ativo',
    contato: { ...e.contato },
    linkEdital: e.linkEdital,
    anexos: [...e.anexos],
    editalId: e.id,
  };
}

/** Cria um edital de renovação na Triagem a partir de um contrato. */
export function editalDeRenovacao(c: Contrato): Edital {
  return {
    id: `ed-${crypto.randomUUID().slice(0, 8)}`,
    cidade: c.cidade,
    uf: c.uf,
    tipoServico: c.tipoServico,
    valor: c.valor,
    modalidade: c.modalidade,
    linkEdital: c.linkEdital,
    contato: { ...c.contato },
    fase: 'triagem',
    anexos: [],
    checklist: [],
    verificacoes: [],
    criadoEm: new Date().toISOString(),
  };
}

export function editalNovo(over: Partial<Edital> = {}): Edital {
  return {
    id: `ed-${crypto.randomUUID().slice(0, 8)}`,
    cidade: '',
    uf: '',
    contato: {},
    fase: 'triagem',
    anexos: [],
    checklist: [],
    verificacoes: [],
    criadoEm: new Date().toISOString(),
    ...over,
  };
}

export function contratoNovo(over: Partial<Contrato> = {}): Contrato {
  return {
    id: `ct-${crypto.randomUUID().slice(0, 8)}`,
    cidade: '',
    uf: '',
    contato: {},
    status: 'ativo',
    anexos: [],
    ...over,
  };
}
