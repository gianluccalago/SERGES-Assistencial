import { describe, it, expect } from 'vitest';
import { deriveObligations, paymentDate, cardPagamentoPrazo } from '../engine';
import { buildHolidaySet, easterSunday, brazilianHolidays, isBusinessDay } from '../holidays';
import { toISODate, utcDate, fromISODate, dayOfWeek } from '../dateUtils';
import { resolveEstado, registrarRetorno } from '../stateMachine';
import { seedProjects } from '../../data/projects';
import type { Obligation } from '../types';

const holidays2026 = buildHolidaySet([2026]);

function byId(obls: Obligation[], id: string): Obligation {
  const found = obls.find((o) => o.id === id);
  if (!found) throw new Error(`obrigação não encontrada: ${id}`);
  return found;
}

describe('feriados e dia útil', () => {
  it('domingo de Páscoa de 2026 é 5 de abril', () => {
    expect(toISODate(easterSunday(2026))).toBe('2026-04-05');
  });

  it('inclui Sexta-feira Santa e Corpus Christi derivados da Páscoa', () => {
    const datas = brazilianHolidays(2026).map((h) => h.date);
    expect(datas).toContain('2026-04-03'); // sexta-feira santa (Páscoa - 2)
    expect(datas).toContain('2026-06-04'); // corpus christi (Páscoa + 60)
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
    const card = byId(obls, 'cardPagamento:dezEmergencias:2026-07');
    expect(card.prazoCalculado).toBe('2026-07-10');
    expect(dayOfWeek(fromISODate(card.prazoCalculado!))).toBe(5);
  });

  it('ASF: pagamento dia 10 é sexta-feira útil, fica em 10 de julho', () => {
    const asf = seedProjects.find((p) => p.id === 'asf')!;
    expect(toISODate(paymentDate(asf, 2026, 7, holidays2026))).toBe('2026-07-10');
  });

  it('Mandirituba: card fica em 20 de julho (segunda)', () => {
    const card = byId(obls, 'cardPagamento:mandirituba:2026-07');
    expect(card.prazoCalculado).toBe('2026-07-20');
    expect(dayOfWeek(fromISODate(card.prazoCalculado!))).toBe(1);
  });

  it('FOPAM de fechamento: último dia útil, 31 de julho (sexta)', () => {
    const fopam = byId(obls, 'fechamento:fopam:2026-07');
    expect(fopam.prazoCalculado).toBe('2026-07-31');
  });

  it('apresentação completa: primeiro dia útil do mês, 1 de julho', () => {
    const a = byId(obls, 'apresentacao:completa:2026-07');
    expect(a.prazoCalculado).toBe('2026-07-01');
  });

  it('apresentação parcial: primeiro dia útil após o dia 15, 16 de julho', () => {
    const a = byId(obls, 'apresentacao:parcial:2026-07');
    expect(a.prazoCalculado).toBe('2026-07-16');
  });

  it('card do Fred (Academia): sempre dia 1', () => {
    const card = byId(obls, 'cardPagamento:academia:2026-07');
    expect(card.prazoCalculado).toBe('2026-07-01');
  });

  it('0600 finalização é prazo crítico', () => {
    const c = byId(obls, 'fixa:finalizar0600:2026-07');
    expect(c.critico).toBe(true);
  });
});

describe('maio de 2026 (dia 10 cai num domingo)', () => {
  it('confirma que 10 de maio é domingo', () => {
    expect(dayOfWeek(utcDate(2026, 5, 10))).toBe(0);
  });

  it('card de pagamento dia 15 antecipa de domingo (10) para sexta (8 de maio)', () => {
    const obls = deriveObligations(2026, 5, seedProjects, holidays2026);
    const card = byId(obls, 'cardPagamento:dezEmergencias:2026-05');
    expect(card.prazoCalculado).toBe('2026-05-08');
    expect(dayOfWeek(fromISODate(card.prazoCalculado!))).toBe(5);
  });

  it('direção oposta: pagamento ADIA, card ANTECIPA', () => {
    const asf = seedProjects.find((p) => p.id === 'asf')!; // pagamento dia 10
    // Pagamento dia 10 (domingo) segue para o próximo dia útil: segunda 11 de maio.
    expect(toISODate(paymentDate(asf, 2026, 5, holidays2026))).toBe('2026-05-11');
    // Card ancorado no dia 10 (pagamento dia 15 − 5 = domingo 10) recua para sexta 8 de maio.
    const dezEmer = seedProjects.find((p) => p.id === 'dezEmergencias')!;
    expect(toISODate(cardPagamentoPrazo(dezEmer, 2026, 5, holidays2026))).toBe('2026-05-08');
  });
});

describe('dependência de terceiro (faturamentoCard)', () => {
  const obls = deriveObligations(2026, 7, seedProjects, holidays2026);

  it('projeto com ordem de compra nasce em aguardandoRetorno, sem prazo', () => {
    const card = byId(obls, 'faturamentoCard:hrl:2026-07');
    expect(card.estado).toBe('aguardandoRetorno');
    expect(card.prazoCalculado).toBeUndefined();
    expect(card.dependenciaAguardada).toBe('ordemDeCompra');
  });

  it('não vira atrasada pela passagem do tempo', () => {
    const card = byId(obls, 'faturamentoCard:hrl:2026-07');
    // mesmo num "hoje" muito posterior, permanece aguardando
    expect(resolveEstado(card, undefined, '2027-01-01')).toBe('aguardandoRetorno');
  });

  it('após registrar o retorno passa a pendente com prazo', () => {
    const card = byId(obls, 'faturamentoCard:hrl:2026-07');
    const user = registrarRetorno(undefined, '2026-07-20', '2026-07-25');
    expect(user.estado).toBe('pendente');
    expect(resolveEstado(card, user, '2026-07-21')).toBe('pendente');
    // depois do prazo manual, vira atrasada
    expect(resolveEstado(card, user, '2026-07-26')).toBe('atrasada');
  });
});

describe('regra de atraso', () => {
  const obls = deriveObligations(2026, 7, seedProjects, holidays2026);

  it('obrigação com prazo vira atrasada após o prazo', () => {
    const card = byId(obls, 'cardPagamento:dezEmergencias:2026-07'); // prazo 10/07
    expect(resolveEstado(card, undefined, '2026-07-09')).toBe('pendente');
    expect(resolveEstado(card, undefined, '2026-07-11')).toBe('atrasada');
  });

  it('concluída pelo usuário tem precedência sobre o atraso', () => {
    const card = byId(obls, 'cardPagamento:dezEmergencias:2026-07');
    expect(resolveEstado(card, { estado: 'concluida' }, '2026-07-30')).toBe('concluida');
  });
});
