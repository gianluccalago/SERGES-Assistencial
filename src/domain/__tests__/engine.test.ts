import { describe, it, expect } from 'vitest';
import { deriveObligations, paymentDate, cardPagamentoPrazo } from '../engine';
import { assembleMonth } from '../resolve';
import { buildHolidaySet, easterSunday, brazilianHolidays, isBusinessDay } from '../holidays';
import { toISODate, utcDate, fromISODate, dayOfWeek } from '../dateUtils';
import { resolveEstado, registrarRetorno, marcadores } from '../stateMachine';
import { seedProjects } from '../../data/projects';
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
    expect(obById(obls, 'cardPagamento:dezEmergencias:2026-07').prazoCalculado).toBe('2026-07-10');
  });
  it('ASF: pagamento dia 10 é sexta-feira útil, fica em 10 de julho', () => {
    const asf = seedProjects.find((p) => p.id === 'asf')!;
    expect(toISODate(paymentDate(asf, 2026, 7, holidays2026))).toBe('2026-07-10');
  });
  it('Mandirituba: card fica em 20 de julho (segunda)', () => {
    expect(obById(obls, 'cardPagamento:mandirituba:2026-07').prazoCalculado).toBe('2026-07-20');
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
    expect(obById(obls, 'cardPagamento:academia:2026-07').prazoCalculado).toBe('2026-07-01');
  });
});

describe('maio de 2026 (dia 10 cai num domingo)', () => {
  it('confirma que 10 de maio é domingo', () => {
    expect(dayOfWeek(utcDate(2026, 5, 10))).toBe(0);
  });
  it('card de pagamento dia 15 antecipa de domingo (10) para sexta (8 de maio)', () => {
    const obls = deriveObligations(2026, 5, seedProjects, holidays2026);
    expect(obById(obls, 'cardPagamento:dezEmergencias:2026-05').prazoCalculado).toBe('2026-05-08');
  });
  it('direção oposta: pagamento ADIA, card ANTECIPA', () => {
    const asf = seedProjects.find((p) => p.id === 'asf')!;
    const dezEmer = seedProjects.find((p) => p.id === 'dezEmergencias')!;
    expect(toISODate(paymentDate(asf, 2026, 5, holidays2026))).toBe('2026-05-11');
    expect(toISODate(cardPagamentoPrazo(dezEmer, 2026, 5, holidays2026))).toBe('2026-05-08');
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
    const card = itemById(month(2026, 7), 'cardPagamento:dezEmergencias:2026-07');
    expect(marcadores(card, '2026-07-09').atrasada).toBe(false);
    expect(marcadores(card, '2026-07-11').atrasada).toBe(true);
    expect(resolveEstado(card)).toBe('pendente'); // status segue sendo pendente
  });
  it('concluída não recebe selo de atraso', () => {
    const ov: Override = { estado: 'concluida' };
    const card = itemById(month(2026, 7, { 'cardPagamento:dezEmergencias:2026-07': ov }), 'cardPagamento:dezEmergencias:2026-07');
    expect(resolveEstado(card)).toBe('concluida');
    expect(marcadores(card, '2026-07-30').atrasada).toBe(false);
  });
});

describe('overrides', () => {
  const id = 'cardPagamento:dezEmergencias:2026-07';

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
