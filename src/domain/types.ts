// Tipos centrais do domínio. Nenhuma dependência de UI ou persistência.

export type DependenciaFaturamento =
  | 'nenhuma'
  | 'fixo'
  | 'empenho'
  | 'ordemDeCompra'
  | 'validacaoContratante'
  | 'relatorioContratante'
  | 'escalista';

export interface Project {
  id: string;
  nome: string;
  ativo: boolean;
  /** Dia nominal de pagamento, 1 a 31. */
  diaPagamento: number;
  /** Texto livre, ex.: "1-31" ou "16-15". */
  afericao: string;
  dependenciaFaturamento: DependenciaFaturamento;
  contratoSocialObrigatorio: boolean;
  escalista?: string;
  notaFiscalPermitida?: boolean;
  /** Texto livre descrevendo exceção de lançamento, ex.: "Fred lança dia 1". */
  excecaoLancamento?: string;
  /** Dia em que a obrigação deve estar lançada, quando difere do pagamento. */
  diaLancamento?: number;
  /** Contato primário para cobrar o retorno (§11.8). */
  contatoPrimario?: string;
  /** Para quem escalar quando há silêncio do contato primário (§11.8). */
  escalarPara?: string;
  /** Teto por nota para notas fracionadas (§11.5), ex.: Ipiranga, Herval. */
  tetoNota?: number;
}

/** Sub-estados do faturamento da ASF (§11.3). */
export type AsfSubEstado =
  | 'enviadoADaniela'
  | 'correcoesSolicitadas'
  | 'emCorrecaoPeloRodrigo'
  | 'aprovado';

export type ObligationTipo =
  | 'cardPagamento'
  | 'faturamentoIniciar'
  | 'faturamentoCard'
  | 'fixa'
  | 'apresentacao'
  | 'fechamento'
  | 'evento';

/**
 * Status de uma obrigação — exatamente quatro (§4.5). "Atrasada", "Crítico" e
 * "Escalado" NÃO são status: são marcadores/selos derivados que coexistem.
 * "Cobrar" e "Escalar" são ações, não status.
 */
export type ObligationEstado = 'pendente' | 'aguardandoInput' | 'emAprovacao' | 'concluida';

/** Indica se o prazo é crítico (antecipa em dia não útil) ou genérico (adia). */
export type AjusteDiaUtil = 'antecipa' | 'adia' | 'nenhum';

/** Obrigação derivada por regra. Função pura do motor; imutável. */
export interface Obligation {
  /** id estável e determinístico: `tipo:chave:competência`. */
  id: string;
  titulo: string;
  projetoId?: string;
  tipo: ObligationTipo;
  /** Descrição da regra de origem, para auditoria. */
  regraOrigem: string;
  /** Competência no formato YYYY-MM. */
  competencia: string;
  /** Data calculada (ISO YYYY-MM-DD). Ausente quando depende de terceiro. */
  prazoCalculado?: string;
  estado: ObligationEstado;
  dependenciaAguardada?: DependenciaFaturamento;
  responsavel?: string;
  /** Marca que o prazo é crítico de fechamento interno. */
  critico?: boolean;
}

/**
 * Ajuste manual sobre uma obrigação GERADA, indexado pelo id estável.
 * O motor gera as obrigações pelas regras e, em cima, aplica os overrides.
 * - dataNova vence a data derivada (move sem apagar a regra).
 * - dismissed remove a obrigação da visão sem que a regra a recrie no mês.
 */
export interface Override {
  /** Nova data (ISO) que vence a derivada. */
  dataNova?: string;
  /** Esconde a obrigação gerada; pode ser desfeito. */
  dismissed?: boolean;
  estado?: ObligationEstado;
  /** Campos editados pelo usuário sobre a obrigação gerada (§4.5). */
  titulo?: string;
  responsavel?: string;
  projetoId?: string;
  /** Anexo da planilha de origem do valor (pré-requisito de cards de pagamento). */
  anexoPresente?: boolean;
  notas?: string;
  /** ISO datetime de quando foi enviada para aprovação (expectativa 24h). */
  enviadaAprovacaoEm?: string;
  /** Registro de recebimento de retorno de terceiro (ISO date). */
  retornoRecebidoEm?: string;
  /** Ação "Escalar" (§4.5): dispara o protocolo, não muda o status. */
  escaladoEm?: string;
  /** Ação "Cobrar" (§4.5): registra cobranças (datas ISO). */
  cobrancas?: string[];
  // --- Extensões de workflow (§11) ---
  /** Guardrail ASPA: médico validou e concordou com o valor das horas (§11.2). */
  aspaConfirmado?: boolean;
  /** Conferência de PIX: a chave corresponde ao vínculo (§11.2). */
  pixConferido?: boolean;
  /** Ordem de compra recebida; destrava o faturamentoCard (§11.5). */
  ocRecebida?: boolean;
  /** Sub-workflow da ASF (§11.3). */
  asfSubEstado?: AsfSubEstado;
  asfTransicoes?: { estado: AsfSubEstado; data: string }[];
  /** ZapSign da documentação FUNEAS/HRL/HRNP/HZN (§11.6). */
  zapsignLink?: string;
  zapsignOk?: boolean;
  /** Checklist do processo 0600 (§11.4). */
  c0600?: { norte?: boolean; capela?: boolean; parelheiros?: boolean; nfsEmitidas?: boolean };
  /** Confirmação do envio do e-mail da FOPAM ao Bismarck (§11.9). */
  fopamConfirmado?: boolean;
  /** Checklists ad-hoc (esteiras do contrato social etc., §11.7). */
  checklist?: Record<string, boolean>;
  /** Trilha de repasse de cargo (§11.11). */
  markedAt?: string;
  markedBy?: string;
}

/**
 * Obrigação criada do zero pelo usuário. Não é derivada de regra; é um
 * registro de primeira classe, editável e removível livremente.
 */
export interface ManualObligation {
  id: string;
  titulo: string;
  /** Data própria (ISO YYYY-MM-DD). */
  data: string;
  projetoId?: string;
  tipo: ObligationTipo;
  responsavel?: string;
  notas?: string;
  estado: ObligationEstado;
  anexoPresente?: boolean;
  critico?: boolean;
  enviadaAprovacaoEm?: string;
  escaladoEm?: string;
  cobrancas?: string[];
  markedAt?: string;
  markedBy?: string;
}

/** Configuração editável do app (§10). Persistida à parte. */
export interface AppConfig {
  /** URL do notebook do Oráculo no NotebookLM. */
  oraculoUrl: string;
}

/** Categoria de contato (§6.5). */
export type ContatoCategoria = 'contratante' | 'interno' | 'contabilidade';

/** Contato operacional (§6.5). Fonte única de contatos do app. */
export interface Contato {
  id: string;
  nome: string;
  papel?: string;
  categoria: ContatoCategoria;
  /** Ids de projetos associados. */
  projetos: string[];
  telefone?: string;
  email?: string;
  notas?: string;
  /** Marca contato de escalonamento (acionado quando o primário não responde). */
  escalonamento?: boolean;
}

export interface Holiday {
  /** ISO YYYY-MM-DD. */
  date: string;
  nome: string;
  /** Escopo: nacional, ou município. */
  escopo: string;
}

/**
 * Item unificado para as visões: resultado de aplicar um Override sobre uma
 * Obligation derivada, ou de promover uma ManualObligation. O estado efetivo
 * (incl. "atrasada") é calculado pela máquina de estados em função de "hoje".
 */
export interface CalendarItem {
  id: string;
  titulo: string;
  tipo: ObligationTipo;
  projetoId?: string;
  responsavel?: string;
  regraOrigem: string;
  competencia: string;
  /** Prazo efetivo (override.dataNova ?? derivado, ou data da manual). */
  prazo?: string;
  dependenciaAguardada?: DependenciaFaturamento;
  critico?: boolean;
  /** Estado-base antes da resolução de atraso. */
  baseEstado: ObligationEstado;
  notas?: string;
  anexoPresente?: boolean;
  enviadaAprovacaoEm?: string;
  /** true para ManualObligation; false para gerada. */
  isManual: boolean;
  /** Indica se o prazo veio de um override (foi movida). */
  movida?: boolean;
  // Guardrails / workflow expostos para a resolução de conclusão (§11).
  aspaConfirmado?: boolean;
  pixConferido?: boolean;
  ocRecebida?: boolean;
  // Marcadores de ação (§4.5).
  escalado?: boolean;
  cobrancasCount?: number;
}
