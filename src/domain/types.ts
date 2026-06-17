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

export interface Obligation {
  /** id estável e determinístico: `tipo:chave:competencia`. */
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

/** Estado mutável marcado pelo usuário, persistido por id de obrigação. */
export interface ObligationUserState {
  estado?: ObligationEstado;
  /** Prazo definido manualmente ao registrar retorno de terceiro. */
  prazoManual?: string;
  /** Anexo da planilha de origem do valor (pré-requisito de cards de pagamento). */
  anexoPlanilha?: boolean;
  /** ISO datetime de quando foi enviada para aprovação. */
  enviadaAprovacaoEm?: string;
  /** Registro de recebimento de retorno de terceiro (ISO date). */
  retornoRecebidoEm?: string;
  observacao?: string;
}

export interface Holiday {
  /** ISO YYYY-MM-DD. */
  date: string;
  nome: string;
  /** Escopo: nacional, ou município. */
  escopo: string;
}
