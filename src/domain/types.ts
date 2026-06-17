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
}

export type ObligationTipo =
  | 'cardPagamento'
  | 'faturamentoIniciar'
  | 'faturamentoCard'
  | 'fixa'
  | 'apresentacao'
  | 'fechamento'
  | 'evento';

export type ObligationEstado =
  | 'pendente'
  | 'emCobranca'
  | 'aguardandoRetorno'
  | 'concluida'
  | 'atrasada'
  | 'escalada';

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
  /** Anexo da planilha de origem do valor (pré-requisito de cards de pagamento). */
  anexoPresente?: boolean;
  notas?: string;
  /** ISO datetime de quando foi enviada para aprovação (expectativa 24h). */
  enviadaAprovacaoEm?: string;
  /** Registro de recebimento de retorno de terceiro (ISO date). */
  retornoRecebidoEm?: string;
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
}
