import { describe, it, expect } from 'vitest';
import { deriveObligations, paymentDate, lotePagamentoPrazo } from '../engine';
import { assembleMonth } from '../resolve';
import { ocorrenciasNoIntervalo } from '../recorrencia';
import { buildHolidaySet, easterSunday, brazilianHolidays, isBusinessDay } from '../holidays';
import { toISODate, utcDate, fromISODate, dayOfWeek } from '../dateUtils';
import { resolveEstado, registrarRetorno, marcadores, progressoTexto } from '../stateMachine';
import { seedProjects } from '../../data/projects';
import { reidratarSelecionado, type ResolvedObligation } from '../../ui/useObligations';
import { situacaoDemanda, podeVer, type Demanda } from '../types';
import type { CalendarItem, ManualObligation, Obligation, Override } from '../types';

const holidays2026 = buildHolidaySet([2025, 2026, 2027]);

function obById(obls: Obligation[], id: string): Obligation {
  const found = obls.find((o) => o.id === id);
  if (!found) throw new Error(`obrigação não encontrada: ${id}`);
  return found;
}

function itemById(items: CalendarItem[], id: string): CalendarItem {
  const found = items.find((o) => o.id === id);
  if (!found) throw new Error(`item não encontrado: ${id}`);
  return found;
}

function month(
  y: number,
  m: number,
  overrides: Record<string, Override> = {},
  manuals: ManualObligation[] = [],
): CalendarItem[] {
  return assembleMonth(y, m, seedProjects, holidays2026, overrides, manuals);
}

describe('feriados e dia útil', () => {
  it('domingo de Páscoa de 2026 é 5 de abril', () => {
    expect(toISODate(easterSunday(2026))).toBe('2026-04-05');
  });
  it('inclui Sexta-feira Santa e Corpus Christi derivados da Páscoa', () => {
    const datas = brazilianHolidays(2026).map((h) => h.date);
    expect(datas).toContain('2026-04-03');
    expect(datas).toContain('2026-06-04');
    expect(datas).toContain('2026-01-01');
    expect(datas).toContain('2026-12-25');
  });
  it('1 de maio de 2026 (feriado) não é dia útil', () => {
    expect(isBusinessDay(utcDate(2026, 5, 1), holidays2026)).toBe(false);
  });
});

describe('julho de 2026 (dia 1 é quarta-feira)', () => {
  const obls = deriveObligations(2026, 7, seedProjects, holidays2026);

  it('confirma que o dia 1 de julho é quarta-feira', () => {
    expect(dayOfWeek(utcDate(2026, 7, 1))).toBe(3);
  });
  it('projetos de pagamento dia 15: card fica em 10 de julho (sexta)', () => {
    expect(obById(obls, 'lotePagamento:dezEmergencias:2026-07').prazoCalculado).toBe('2026-07-10');
  });
  it('ASF: pagamento dia 10 é sexta-feira útil, fica em 10 de julho', () => {
    const asf = seedProjects.find((p) => p.id === 'asf')!;
    expect(toISODate(paymentDate(asf, 2026, 7, holidays2026))).toBe('2026-07-10');
  });
  it('Mandirituba: card fica em 20 de julho (segunda)', () => {
    expect(obById(obls, 'lotePagamento:mandirituba:2026-07').prazoCalculado).toBe('2026-07-20');
  });
  it('FOPAM de fechamento: último dia útil, 31 de julho', () => {
    expect(obById(obls, 'fechamento:fopam:2026-07').prazoCalculado).toBe('2026-07-31');
  });
  it('apresentação completa: primeiro dia útil do mês, 1 de julho', () => {
    expect(obById(obls, 'apresentacao:completa:2026-07').prazoCalculado).toBe('2026-07-01');
  });
  it('apresentação parcial: primeiro dia útil após o dia 15, 16 de julho', () => {
    expect(obById(obls, 'apresentacao:parcial:2026-07').prazoCalculado).toBe('2026-07-16');
  });
  it('card do Fred (Academia): sempre dia 1', () => {
    expect(obById(obls, 'lotePagamento:academia:2026-07').prazoCalculado).toBe('2026-07-01');
  });
  it('UPA Palmas inicia faturamento no dia 21 (aferição 20-19)', () => {
    expect(obById(obls, 'faturamentoIniciar:upaPalmas:2026-07').prazoCalculado).toBe('2026-07-21');
  });
});

describe('maio de 2026 (dia 10 cai num domingo)', () => {
  it('confirma que 10 de maio é domingo', () => {
    expect(dayOfWeek(utcDate(2026, 5, 10))).toBe(0);
  });
  it('card de pagamento dia 15 antecipa de domingo (10) para sexta (8 de maio)', () => {
    const obls = deriveObligations(2026, 5, seedProjects, holidays2026);
    expect(obById(obls, 'lotePagamento:dezEmergencias:2026-05').prazoCalculado).toBe('2026-05-08');
  });
  it('direção oposta: pagamento ADIA, card ANTECIPA', () => {
    const asf = seedProjects.find((p) => p.id === 'asf')!;
    const dezEmer = seedProjects.find((p) => p.id === 'dezEmergencias')!;
    expect(toISODate(paymentDate(asf, 2026, 5, holidays2026))).toBe('2026-05-11');
    expect(toISODate(lotePagamentoPrazo(dezEmer, 2026, 5, holidays2026))).toBe('2026-05-08');
  });
});

describe('dependência de terceiro (faturamentoCard)', () => {
  it('projeto com ordem de compra nasce aguardando o contratante, sem prazo', () => {
    const card = itemById(month(2026, 7), 'faturamentoCard:hrl:2026-07');
    expect(card.baseEstado).toBe('aguardandoInput');
    expect(card.prazo).toBeUndefined();
    expect(card.dependenciaAguardada).toBe('ordemDeCompra');
  });
  it('não vira atrasada (por culpa nossa) pela passagem do tempo', () => {
    const card = itemById(month(2026, 7), 'faturamentoCard:hrl:2026-07');
    expect(resolveEstado(card)).toBe('aguardandoInput');
    expect(marcadores(card, '2027-01-01').atrasada).toBe(false);
  });
  it('após registrar o retorno passa a pendente com prazo (via override)', () => {
    const ov = registrarRetorno(undefined, '2026-07-20', '2026-07-25');
    expect(ov.estado).toBe('pendente');
    expect(ov.dataNova).toBe('2026-07-25');
    const card = itemById(month(2026, 7, { 'faturamentoCard:hrl:2026-07': ov }), 'faturamentoCard:hrl:2026-07');
    expect(card.prazo).toBe('2026-07-25');
    expect(resolveEstado(card)).toBe('pendente');
    expect(marcadores(card, '2026-07-21').atrasada).toBe(false);
    expect(marcadores(card, '2026-07-26').atrasada).toBe(true);
  });
});

describe('marcador de atraso (selo, não status)', () => {
  it('obrigação com prazo recebe o selo atrasada após o prazo', () => {
    const card = itemById(month(2026, 7), 'lotePagamento:dezEmergencias:2026-07');
    expect(marcadores(card, '2026-07-09').atrasada).toBe(false);
    expect(marcadores(card, '2026-07-11').atrasada).toBe(true);
    expect(resolveEstado(card)).toBe('pendente'); // status segue sendo pendente
  });
  it('concluída não recebe selo de atraso', () => {
    const ov: Override = { estado: 'concluida' };
    const card = itemById(month(2026, 7, { 'lotePagamento:dezEmergencias:2026-07': ov }), 'lotePagamento:dezEmergencias:2026-07');
    expect(resolveEstado(card)).toBe('concluida');
    expect(marcadores(card, '2026-07-30').atrasada).toBe(false);
  });
});

describe('overrides', () => {
  const id = 'lotePagamento:dezEmergencias:2026-07';

  it('mover uma obrigação gera override; aparece na nova data, não na derivada', () => {
    const items = month(2026, 7, { [id]: { dataNova: '2026-07-22' } });
    const card = itemById(items, id);
    expect(card.prazo).toBe('2026-07-22');
    expect(card.movida).toBe(true);
  });

  it('mover para outro mês remove do mês de origem e insere no destino', () => {
    const ovs = { [id]: { dataNova: '2026-08-03' } };
    expect(month(2026, 7, ovs).find((i) => i.id === id)).toBeUndefined();
    const ago = month(2026, 8, ovs).find((i) => i.id === id);
    expect(ago?.prazo).toBe('2026-08-03');
  });

  it('excluir (dismissed) esconde a obrigação e a regra não a recria no mês', () => {
    const items = month(2026, 7, { [id]: { dismissed: true } });
    expect(items.find((i) => i.id === id)).toBeUndefined();
  });

  it('desfazer o dismissed reexibe a obrigação na data derivada', () => {
    const items = month(2026, 7, { [id]: { dismissed: false } });
    expect(itemById(items, id).prazo).toBe('2026-07-10');
  });
});

describe('obrigações manuais', () => {
  const manual: ManualObligation = {
    id: 'manual:abc',
    titulo: 'Reunião extraordinária',
    data: '2026-07-09',
    tipo: 'evento',
    estado: 'pendente',
    responsavel: 'Gianlucca',
  };

  it('uma obrigação manual aparece no mês do seu prazo', () => {
    const item = itemById(month(2026, 7, {}, [manual]), 'manual:abc');
    expect(item.isManual).toBe(true);
    expect(item.prazo).toBe('2026-07-09');
    expect(item.responsavel).toBe('Gianlucca');
  });

  it('não aparece em outro mês', () => {
    expect(month(2026, 8, {}, [manual]).find((i) => i.id === 'manual:abc')).toBeUndefined();
  });

  it('mover uma manual altera apenas a data do registro (editável livremente)', () => {
    const movida: ManualObligation = { ...manual, data: '2026-07-15' };
    expect(itemById(month(2026, 7, {}, [movida]), 'manual:abc').prazo).toBe('2026-07-15');
  });
});

describe('utilitário', () => {
  it('fromISODate é estável em UTC', () => {
    expect(toISODate(fromISODate('2026-07-10'))).toBe('2026-07-10');
  });
});

// ---------------------------------------------------------------------------
// Setores: um setor fora do assistencial (ex.: Financeiro) tem calendário
// próprio — só séries mensais e obrigações manuais. Nada do assistencial pode
// vazar para lá (nem as regras de faturamento, nem as séries-semente).
// ---------------------------------------------------------------------------
describe('setores — calendário isolado fora do assistencial', () => {
  const semMotor = { motorAssistencial: false };

  it('não gera nada derivado de projeto (lote, faturamento, card)', () => {
    const obls = deriveObligations(2026, 7, seedProjects, holidays2026, [], semMotor);
    expect(obls.filter((o) => o.tipo === 'lotePagamento')).toHaveLength(0);
    expect(obls.filter((o) => o.tipo === 'faturamentoIniciar')).toHaveLength(0);
    expect(obls.filter((o) => o.tipo === 'faturamentoCard')).toHaveLength(0);
  });

  it('não gera FOPAM nem apresentações (compromissos do assistencial)', () => {
    const obls = deriveObligations(2026, 7, seedProjects, holidays2026, [], semMotor);
    expect(obls.filter((o) => o.tipo === 'fechamento')).toHaveLength(0);
    expect(obls.filter((o) => o.tipo === 'apresentacao')).toHaveLength(0);
  });

  it('setor sem série cadastrada tem o mês vazio (não cai nas séries-semente)', () => {
    expect(deriveObligations(2026, 7, seedProjects, holidays2026, [], semMotor)).toHaveLength(0);
  });

  it('gera as séries do próprio setor, com a regra de dia útil', () => {
    const serie = { chave: 'financeiro-caixa', dia: 5, titulo: 'Fechar o caixa', modo: 'antecipa' as const };
    const obls = deriveObligations(2026, 7, seedProjects, holidays2026, [serie], semMotor);
    expect(obls).toHaveLength(1);
    expect(obls[0].titulo).toBe('Fechar o caixa');
    // 5/7/2026 é domingo: prazo crítico antecipa para sexta 3/7.
    expect(obls[0].prazoCalculado).toBe('2026-07-03');
  });

  it('obrigações manuais do setor continuam aparecendo', () => {
    const manual: ManualObligation = {
      id: 'manual:fin1', titulo: 'Pagar aluguel', data: '2026-07-09',
      tipo: 'evento', estado: 'pendente', responsavel: 'Estagiário',
    };
    const itens = assembleMonth(2026, 7, [], holidays2026, {}, [manual], [], semMotor);
    expect(itens).toHaveLength(1);
    expect(itens[0].titulo).toBe('Pagar aluguel');
  });

  it('o assistencial segue intacto (mesma derivação de sempre)', () => {
    const antes = deriveObligations(2026, 7, seedProjects, holidays2026);
    const depois = deriveObligations(2026, 7, seedProjects, holidays2026, undefined, { motorAssistencial: true });
    expect(depois).toEqual(antes);
    expect(antes.some((o) => o.tipo === 'fechamento')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Responsável de série: definido uma vez, vale para todos os meses; editar a
// obrigação de um mês continua sobrepondo apenas aquele mês.
// ---------------------------------------------------------------------------
describe('responsável da série', () => {
  const serie = {
    chave: 'financeiro-caixa', dia: 10, titulo: 'Fechar o caixa',
    modo: 'adia' as const, responsavel: 'Juliano',
  };

  it('propaga para a obrigação gerada em qualquer mês', () => {
    for (const m of [1, 7, 12]) {
      const obls = deriveObligations(2026, m, [], holidays2026, [serie], { motorAssistencial: false });
      expect(obls[0].responsavel).toBe('Juliano');
    }
  });

  it('série sem responsável continua sem responsável (nada quebra)', () => {
    const semResp = { chave: 'x', dia: 5, titulo: 'Algo', modo: 'adia' as const };
    const obls = deriveObligations(2026, 7, [], holidays2026, [semResp], { motorAssistencial: false });
    expect(obls[0].responsavel).toBeUndefined();
  });

  it('editar um mês sobrepõe só aquele mês', () => {
    const ov: Record<string, Override> = { 'fixa:financeiro-caixa:2026-07': { responsavel: 'Estagiário' } };
    const julho = assembleMonth(2026, 7, [], holidays2026, ov, [], [serie], { motorAssistencial: false });
    const agosto = assembleMonth(2026, 8, [], holidays2026, ov, [], [serie], { motorAssistencial: false });
    expect(itemById(julho, 'fixa:financeiro-caixa:2026-07').responsavel).toBe('Estagiário');
    expect(itemById(agosto, 'fixa:financeiro-caixa:2026-08').responsavel).toBe('Juliano');
  });
});

// ---------------------------------------------------------------------------
// Tarefas recorrentes: diária, semanal (com dias da semana), mensal, anual,
// intervalo customizado ("a cada N") e data-limite.
// ---------------------------------------------------------------------------
describe('recorrência de tarefas', () => {
  const tarefa = (over: Partial<ManualObligation>): ManualObligation => ({
    id: 'manual:r1', titulo: 'Repetida', data: '2026-07-01',
    tipo: 'evento', estado: 'pendente', ...over,
  });
  const datas = (m: ManualObligation, de: string, ate: string) =>
    ocorrenciasNoIntervalo(m, de, ate, holidays2026);

  it('diária: todo dia', () => {
    const r = datas(tarefa({ recorrencia: { frequencia: 'diaria', intervalo: 1 } }), '2026-07-01', '2026-07-05');
    expect(r).toEqual(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
  });

  it('diária a cada 3 dias', () => {
    const r = datas(tarefa({ recorrencia: { frequencia: 'diaria', intervalo: 3 } }), '2026-07-01', '2026-07-10');
    expect(r).toEqual(['2026-07-01', '2026-07-04', '2026-07-07', '2026-07-10']);
  });

  it('semanal: mesmo dia da semana da data-base', () => {
    // 2026-07-01 é quarta
    const r = datas(tarefa({ recorrencia: { frequencia: 'semanal', intervalo: 1 } }), '2026-07-01', '2026-07-31');
    expect(r).toEqual(['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29']);
  });

  it('semanal em dias escolhidos (segunda e quinta)', () => {
    const r = datas(
      tarefa({ recorrencia: { frequencia: 'semanal', intervalo: 1, diasSemana: [1, 4] } }),
      '2026-07-01', '2026-07-14',
    );
    // não volta antes da data-base (01/07, quarta)
    expect(r).toEqual(['2026-07-02', '2026-07-06', '2026-07-09', '2026-07-13']);
  });

  it('quinzenal (a cada 2 semanas)', () => {
    const r = datas(tarefa({ recorrencia: { frequencia: 'semanal', intervalo: 2 } }), '2026-07-01', '2026-08-15');
    expect(r).toEqual(['2026-07-01', '2026-07-15', '2026-07-29', '2026-08-12']);
  });

  it('mensal: mesmo dia, encolhendo em mês curto', () => {
    const m = tarefa({ data: '2026-01-31', recorrencia: { frequencia: 'mensal', intervalo: 1 } });
    expect(datas(m, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('anual', () => {
    const m = tarefa({ data: '2026-03-10', recorrencia: { frequencia: 'anual', intervalo: 1 } });
    expect(datas(m, '2026-01-01', '2028-12-31')).toEqual(['2026-03-10', '2027-03-10', '2028-03-10']);
  });

  it('respeita a data-limite e não gera nada antes da data-base', () => {
    const m = tarefa({ recorrencia: { frequencia: 'diaria', intervalo: 1, ate: '2026-07-03' } });
    expect(datas(m, '2026-06-01', '2026-07-31')).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('aplica a regra de dia útil em cada ocorrência', () => {
    // Todo dia 5; em julho/2026 cai domingo → antecipa para sexta 03/07.
    const m = tarefa({ data: '2026-07-05', recorrencia: { frequencia: 'mensal', intervalo: 1, modo: 'antecipa' } });
    expect(datas(m, '2026-07-01', '2026-07-31')).toEqual(['2026-07-03']);
  });

  it('salta janelas distantes sem varrer dia a dia', () => {
    const m = tarefa({ data: '2020-01-01', recorrencia: { frequencia: 'diaria', intervalo: 1 } });
    const r = datas(m, '2026-07-01', '2026-07-03');
    expect(r).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('cada data tem status próprio: concluir uma não mexe nas outras', () => {
    const m = tarefa({ recorrencia: { frequencia: 'diaria', intervalo: 1, ate: '2026-07-03' } });
    const ov: Record<string, Override> = { 'manual:r1@2026-07-02': { estado: 'concluida' } };
    const itens = assembleMonth(2026, 7, [], holidays2026, ov, [m], [], { motorAssistencial: false });
    expect(itens).toHaveLength(3);
    expect(itemById(itens, 'manual:r1@2026-07-02').baseEstado).toBe('concluida');
    expect(itemById(itens, 'manual:r1@2026-07-01').baseEstado).toBe('pendente');
    expect(itemById(itens, 'manual:r1@2026-07-03').baseEstado).toBe('pendente');
    expect(itemById(itens, 'manual:r1@2026-07-01').ocorrenciaDe).toBe('manual:r1');
  });

  it('ocultar uma ocorrência remove só aquela data', () => {
    const m = tarefa({ recorrencia: { frequencia: 'diaria', intervalo: 1, ate: '2026-07-03' } });
    const ov: Record<string, Override> = { 'manual:r1@2026-07-02': { dismissed: true } };
    const itens = assembleMonth(2026, 7, [], holidays2026, ov, [m], [], { motorAssistencial: false });
    expect(itens.map((i) => i.prazo)).toEqual(['2026-07-01', '2026-07-03']);
  });

  it('tarefa sem recorrência continua com data única', () => {
    const itens = assembleMonth(2026, 7, [], holidays2026, {}, [tarefa({})], [], { motorAssistencial: false });
    expect(itens).toHaveLength(1);
    expect(itens[0].isManual).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Subtarefas (etapas da obrigação): progresso e escopo.
// ---------------------------------------------------------------------------
describe('subtarefas', () => {
  const etapas = [
    { id: 'st-1', titulo: 'Levantar notas', feita: true },
    { id: 'st-2', titulo: 'Conferir valores' },
    { id: 'st-3', titulo: 'Enviar ao contratante' },
  ];

  it('mostra o progresso na linha da obrigação', () => {
    const m: ManualObligation = {
      id: 'manual:s1', titulo: 'Fechamento', data: '2026-07-09',
      tipo: 'evento', estado: 'pendente', subtarefas: etapas,
    };
    const item = itemById(assembleMonth(2026, 7, [], holidays2026, {}, [m], [], { motorAssistencial: false }), 'manual:s1');
    expect(item.subtarefas).toHaveLength(3);
    expect(progressoTexto(item)).toBe('1 de 3 etapas');
  });

  it('obrigação gerada guarda as etapas no override', () => {
    const serie = { chave: 'fin-caixa', dia: 10, titulo: 'Fechar caixa', modo: 'adia' as const };
    const ov: Record<string, Override> = { 'fixa:fin-caixa:2026-07': { subtarefas: etapas } };
    const item = itemById(
      assembleMonth(2026, 7, [], holidays2026, ov, [], [serie], { motorAssistencial: false }),
      'fixa:fin-caixa:2026-07',
    );
    expect(progressoTexto(item)).toBe('1 de 3 etapas');
  });

  it('sem etapas, nada de progresso (não polui a linha)', () => {
    const m: ManualObligation = {
      id: 'manual:s2', titulo: 'Simples', data: '2026-07-09', tipo: 'evento', estado: 'pendente',
    };
    const item = itemById(assembleMonth(2026, 7, [], holidays2026, {}, [m], [], { motorAssistencial: false }), 'manual:s2');
    expect(progressoTexto(item)).toBeNull();
  });

  it('tarefa repetida: cada data tem a própria lista, sem contaminar as outras', () => {
    const m: ManualObligation = {
      id: 'manual:r9', titulo: 'Repetida', data: '2026-07-01', tipo: 'evento', estado: 'pendente',
      recorrencia: { frequencia: 'diaria', intervalo: 1, ate: '2026-07-03' },
      subtarefas: [{ id: 'st-a', titulo: 'Padrão' }],
    };
    const ov: Record<string, Override> = {
      'manual:r9@2026-07-02': { subtarefas: [{ id: 'st-a', titulo: 'Padrão', feita: true }] },
    };
    const itens = assembleMonth(2026, 7, [], holidays2026, ov, [m], [], { motorAssistencial: false });
    expect(progressoTexto(itemById(itens, 'manual:r9@2026-07-02'))).toBe('1 de 1 etapas');
    // as outras datas herdam a lista da tarefa-mãe, ainda não feita
    expect(progressoTexto(itemById(itens, 'manual:r9@2026-07-01'))).toBe('0 de 1 etapas');
    expect(progressoTexto(itemById(itens, 'manual:r9@2026-07-03'))).toBe('0 de 1 etapas');
  });
});

// ---------------------------------------------------------------------------
// Painel de detalhe: precisa refletir o estado atual, não a foto do clique.
// (Era a causa de "não deixa concluir" e de ter que fechar o card para ver a
//  etapa adicionada/reordenada.)
// ---------------------------------------------------------------------------
describe('reidratação do item aberto no painel', () => {
  const ro = (id: string, over: Partial<CalendarItem> = {}): ResolvedObligation => {
    const item: CalendarItem = {
      id, titulo: 'T', tipo: 'evento', regraOrigem: '', competencia: '2026-07',
      prazo: '2026-07-09', baseEstado: 'pendente', isManual: true, ...over,
    };
    // O prazo externo espelha o do item — é assim que resolveItem monta.
    return {
      item, estado: 'pendente', atrasada: false, contratanteAtrasado: false, critico: false,
      escalado: false, cobrancasCount: 0, prazo: item.prazo,
      aprovacaoEstourada: false, podeConcluir: true,
    };
  };

  const vazio = () => [];

  it('devolve a versão viva do mês, não a que foi clicada', () => {
    const foto = ro('x1', { subtarefas: [{ id: 'a', titulo: 'Etapa' }] });
    const vivo = ro('x1', { subtarefas: [{ id: 'a', titulo: 'Etapa', feita: true }] });
    const r = reidratarSelecionado(foto, [vivo], vazio);
    expect(r?.item.subtarefas?.[0].feita).toBe(true);
  });

  it('reflete mudança de status feita no store', () => {
    const foto = ro('x2');
    const vivo = { ...ro('x2'), estado: 'concluida' as const };
    expect(reidratarSelecionado(foto, [vivo], vazio)?.estado).toBe('concluida');
  });

  it('item de outro mês (visão Semana) é resolvido no mês dele', () => {
    const foto = ro('x3', { prazo: '2026-08-03', competencia: '2026-08' });
    const vivo = ro('x3', { prazo: '2026-08-03', competencia: '2026-08', notas: 'atualizado' });
    const r = reidratarSelecionado(foto, [], (y, m) => (y === 2026 && m === 8 ? [vivo] : []));
    expect(r?.item.notas).toBe('atualizado');
  });

  it('sem encontrar em lugar nenhum, mantém o que já estava (nunca some da tela)', () => {
    const foto = ro('x4');
    expect(reidratarSelecionado(foto, [], vazio)).toBe(foto);
  });

  it('nada aberto continua nada aberto', () => {
    expect(reidratarSelecionado(null, [], vazio)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Demandas: período (sem data fixa) e visibilidade. `podeVer` espelha o RLS —
// a segurança de verdade está no banco; aqui garantimos que a tela concorda.
// ---------------------------------------------------------------------------
describe('demandas', () => {
  const base = (over: Partial<Demanda> = {}): Demanda => ({
    id: 'dem-1', titulo: 'Ajuste no cockpit', inicio: '2026-08-01', prazo: '2026-08-30',
    estado: 'pendente', criadoEm: '2026-08-01T12:00:00Z', criadoPor: 'tayla', ...over,
  });

  it('conta os dias restantes até o prazo máximo', () => {
    expect(situacaoDemanda(base(), '2026-08-05').diasRestantes).toBe(25);
    expect(situacaoDemanda(base(), '2026-08-30').diasRestantes).toBe(0);
  });

  it('passa a atrasada depois do prazo, mas não se já foi entregue', () => {
    expect(situacaoDemanda(base(), '2026-09-02').atrasada).toBe(true);
    expect(situacaoDemanda(base({ estado: 'concluida' }), '2026-09-02').atrasada).toBe(false);
    expect(situacaoDemanda(base({ estado: 'concluida' }), '2026-09-02').concluida).toBe(true);
  });

  it('marca o período que ainda não começou', () => {
    expect(situacaoDemanda(base(), '2026-07-20').futura).toBe(true);
    expect(situacaoDemanda(base(), '2026-08-10').futura).toBe(false);
  });

  it('visibilidade padrão: todo o setor vê', () => {
    expect(podeVer(base(), 'juliano', false)).toBe(true);
    expect(podeVer(base({ visibilidade: 'setor' }), 'juliano', false)).toBe(true);
  });

  it('restrita: só o criador, os autorizados e o gestor', () => {
    const d = base({ visibilidade: 'restrita', permitidos: ['bruna'] });
    expect(podeVer(d, 'tayla', false)).toBe(true);   // criou
    expect(podeVer(d, 'bruna', false)).toBe(true);   // autorizada
    expect(podeVer(d, 'juliano', false)).toBe(false); // de fora
    expect(podeVer(d, 'juliano', true)).toBe(true);  // gestor do setor
    expect(podeVer(d, undefined, false)).toBe(false); // sem sessão
  });
});
