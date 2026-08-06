// Tipos centrais do domínio. Nenhuma dependência de UI ou persistência.

/**
 * Setor (área da empresa) dono dos dados. Cada setor tem o próprio calendário:
 * projetos, séries, obrigações e contatos são isolados — ninguém vê o do outro
 * (o isolamento é garantido no banco por RLS, não só na tela).
 *
 * - `assistencial`: setor original, com o motor de faturamento (lotes de
 *   pagamento, cards de faturamento, FOPAM e apresentações).
 * - `financeiro`: calendário próprio, montado por séries mensais e obrigações
 *   criadas à mão — sem as regras específicas do assistencial.
 */
export type Setor = 'assistencial' | 'financeiro';

export const SETORES: Setor[] = ['assistencial', 'financeiro'];

export const SETOR_LABEL: Record<Setor, string> = {
  assistencial: 'Assistencial',
  financeiro: 'Financeiro',
};

/** O setor roda o motor de regras do assistencial (faturamento/FOPAM)? */
export function usaMotorAssistencial(setor: Setor): boolean {
  return setor === 'assistencial';
}

/**
 * Prefixo dos ids criados no setor. As chaves primárias são globais no banco,
 * então ids gerados a partir do nome (projetos) precisam ser separados por
 * setor para dois setores poderem ter "Fornecedores" sem colidir. O
 * assistencial fica sem prefixo, preservando todos os ids já existentes.
 */
export function prefixoSetor(setor: Setor): string {
  return setor === 'assistencial' ? '' : `${setor}-`;
}

/**
 * Id da linha única de configuração do setor em `app_config` (chave primária
 * numérica e global). O assistencial mantém o id 1 histórico.
 */
export function idConfigSetor(setor: Setor): number {
  const i = SETORES.indexOf(setor);
  return i < 0 ? 1 : i + 1;
}

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
  /** Dia-âncora para iniciar o faturamento (padrão 1; ASF 16; UPA Palmas 21). */
  diaFaturamentoIniciar?: number;
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
  | 'lotePagamento'
  | 'faturamentoIniciar'
  | 'faturamentoCard'
  | 'fixa'
  | 'apresentacao'
  | 'fechamento'
  | 'evento';

/** Resolução explícita de mês para pagamento/faturamento (§4.5). */
export type ResolucaoMes = 'semAtuacao' | 'faturadoParcialmente';

/**
 * Etapa de uma obrigação (subtarefa). O id é estável: renomear o texto não
 * perde a marcação, e a ordem da lista é a ordem de execução.
 */
export interface Subtarefa {
  id: string;
  titulo: string;
  feita?: boolean;
}

/** Médico entrante na alteração do contrato social. */
export interface EntranteCS {
  id: string;
  nome: string;
  procuracao?: boolean;
  boleto?: boolean;
}

/** Dados da obrigação de alteração do contrato social. */
export interface ContratoSocialData {
  confirmacaoEscalistas?: boolean;
  entrantes?: EntranteCS[];
  saintes?: { id: string; nome: string }[];
}

/**
 * Status de uma obrigação — exatamente quatro (§4.5). "Atrasada", "Crítico" e
 * "Escalado" NÃO são status: são marcadores/selos derivados que coexistem.
 * "Cobrar" e "Escalar" são ações, não status.
 */
export type ObligationEstado = 'pendente' | 'aguardandoInput' | 'emAprovacao' | 'concluida';

/** Indica se o prazo é crítico (antecipa em dia não útil) ou genérico (adia). */
export type AjusteDiaUtil = 'antecipa' | 'adia' | 'nenhum';

/**
 * Compromisso em série (tarefa fixa mensal), editável pelo usuário.
 * Define a "regra de origem": dia-âncora + regra de dia útil.
 */
export interface TarefaFixa {
  chave: string;
  dia: number;
  titulo: string;
  modo: AjusteDiaUtil;
  critico?: boolean;
  /** Responsável padrão da série; vale para todos os meses. Editar a obrigação
   * de um mês específico continua sobrepondo só aquele mês. */
  responsavel?: string;
}

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
  /** Esconde a obrigação gerada ("Ocultar"); pode ser desfeito. */
  dismissed?: boolean;
  estado?: ObligationEstado;
  /** Resolução de mês (§4.5): sem atuação ou faturado parcialmente. */
  resolucaoMes?: ResolucaoMes;
  /** Valor faltante quando faturado parcialmente. */
  valorFaltante?: number;
  /** Recuperação carregada do mês anterior (faturamento parcial). */
  recuperacao?: { texto: string; valor: number };
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
  /** Etapas da obrigação, criadas pelo usuário. Numa tarefa repetida, cada
   * data tem a própria lista (o override é por ocorrência). */
  subtarefas?: Subtarefa[];
  /** Alteração do contrato social: entrantes, saintes e confirmação. */
  contratoSocial?: ContratoSocialData;
  /** Trilha de repasse de cargo (§11.11). */
  markedAt?: string;
  markedBy?: string;
}

/** Com que frequência uma tarefa se repete. */
export type FrequenciaRecorrencia = 'diaria' | 'semanal' | 'mensal' | 'anual';

/**
 * Recorrência de uma obrigação criada à mão. A obrigação guarda a data-base
 * (primeira ocorrência) e esta regra; as repetições são calculadas na hora,
 * nunca gravadas uma a uma. Assim mudar a regra reescreve todo o futuro.
 */
export interface Recorrencia {
  frequencia: FrequenciaRecorrencia;
  /** Repete a cada N dias/semanas/meses/anos. 1 = toda vez. */
  intervalo: number;
  /** Última data possível (ISO). Sem isso, repete indefinidamente. */
  ate?: string;
  /** Só para 'semanal': dias da semana (0=domingo … 6=sábado). Vazio = o mesmo
   * dia da semana da data-base. */
  diasSemana?: number[];
  /** Regra de dia útil aplicada a cada ocorrência (antecipa/adia). */
  modo?: AjusteDiaUtil;
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
  /** Quando presente, `data` é a 1ª ocorrência e a tarefa se repete por esta regra. */
  recorrencia?: Recorrencia;
  /** Etapas da tarefa, criadas pelo usuário. */
  subtarefas?: Subtarefa[];
  /** Quem enxerga esta tarefa (padrão: todo o setor). */
  visibilidade?: Visibilidade;
  permitidos?: string[];
  /** profiles.id de quem criou. */
  criadoPor?: string;
}

// ---------------------------------------------------------------------------
// Demandas: trabalho repassado que está em andamento e NÃO tem data fixa de
// execução — só um período (de … até), com prazo máximo de entrega.
// ---------------------------------------------------------------------------

/**
 * Quem enxerga o registro.
 * - 'setor'    → todo mundo do setor (padrão, como sempre foi).
 * - 'restrita' → só quem criou, quem está na lista e o gestor do setor.
 *
 * A regra vale no BANCO (RLS), não só na tela: quem não pode ver não recebe a
 * linha na consulta.
 */
export type Visibilidade = 'setor' | 'restrita';

export interface Demanda {
  id: string;
  titulo: string;
  descricao?: string;
  /** Nome de quem toca a demanda (texto livre, como no resto do app). */
  responsavel?: string;
  /** Início do período (ISO). */
  inicio: string;
  /** Prazo máximo de entrega (ISO). */
  prazo: string;
  estado: ObligationEstado;
  projetoId?: string;
  /** Etapas, para acompanhar o andamento. */
  subtarefas?: Subtarefa[];
  /** profiles.id de quem criou (sempre enxerga a própria demanda). */
  criadoPor?: string;
  criadoEm: string;
  concluidaEm?: string;
  visibilidade?: Visibilidade;
  /** profiles.id de quem mais pode ver, quando 'restrita'. */
  permitidos?: string[];
  /** Tirada da lista depois de entregue. Continua no banco, só sai da frente. */
  arquivada?: boolean;
}

/** Situação de uma demanda em relação ao prazo máximo. */
export interface SituacaoDemanda {
  concluida: boolean;
  atrasada: boolean;
  /** Dias até o prazo (negativo = dias de atraso). */
  diasRestantes: number;
  /** Ainda não começou o período. */
  futura: boolean;
}

export function situacaoDemanda(d: Demanda, hojeISO: string): SituacaoDemanda {
  const concluida = d.estado === 'concluida';
  const dia = 86_400_000;
  const diasRestantes = Math.round(
    (Date.parse(`${d.prazo}T00:00:00Z`) - Date.parse(`${hojeISO}T00:00:00Z`)) / dia,
  );
  return {
    concluida,
    atrasada: !concluida && diasRestantes < 0,
    diasRestantes,
    futura: hojeISO < d.inicio,
  };
}

/**
 * Pode ver o registro? Espelha a regra do RLS, para a tela não oferecer o que o
 * banco vai recusar. A segurança de verdade está no banco.
 */
export function podeVer(
  r: { visibilidade?: Visibilidade; permitidos?: string[]; criadoPor?: string },
  usuarioId: string | undefined,
  isGestor: boolean,
): boolean {
  if ((r.visibilidade ?? 'setor') === 'setor') return true;
  if (isGestor) return true;
  if (!usuarioId) return false;
  return r.criadoPor === usuarioId || (r.permitidos ?? []).includes(usuarioId);
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
  /** Id da tarefa recorrente que gerou esta ocorrência (quando for repetição).
   * O status de cada data é guardado à parte, como nas obrigações geradas. */
  ocorrenciaDe?: string;
  /** Etapas da obrigação (checklist de acompanhamento). */
  subtarefas?: Subtarefa[];
  /** Indica se o prazo veio de um override (foi movida). */
  movida?: boolean;
  // Guardrails / workflow expostos para a resolução de conclusão (§11).
  aspaConfirmado?: boolean;
  pixConferido?: boolean;
  ocRecebida?: boolean;
  // Marcadores de ação (§4.5).
  escalado?: boolean;
  cobrancasCount?: number;
  // Lote de pagamento (§4.3) e resoluções de mês (§4.5).
  resolucaoMes?: ResolucaoMes;
  recuperacao?: { texto: string; valor: number };
  contratoSocial?: ContratoSocialData;
}
