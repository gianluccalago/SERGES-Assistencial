import { describe, it, expect } from 'vitest';
import {
  ASF_FLOW,
  asfNext,
  asfPrev,
  asfAprovado,
  notasFracionadas,
  maxDuasCasas,
  cardDevolucaoContratoSocial,
} from '../workflows';
import { podeConcluir, guardrailsCardPagamento } from '../stateMachine';
import type { CalendarItem } from '../types';

function card(extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'cardPagamento:asf:2026-07',
    titulo: 'Card',
    tipo: 'cardPagamento',
    regraOrigem: '',
    competencia: '2026-07',
    prazo: '2026-07-10',
    baseEstado: 'pendente',
    isManual: false,
    ...extra,
  };
}

describe('guardrails do card de pagamento (§11.2)', () => {
  it('não conclui sem anexo + ASPA + PIX', () => {
    expect(podeConcluir(card())).toBe(false);
    expect(podeConcluir(card({ anexoPresente: true }))).toBe(false);
    expect(podeConcluir(card({ anexoPresente: true, aspaConfirmado: true }))).toBe(false);
  });
  it('conclui com os três guardrails', () => {
    const c = card({ anexoPresente: true, aspaConfirmado: true, pixConferido: true });
    expect(podeConcluir(c)).toBe(true);
    expect(guardrailsCardPagamento(c).completo).toBe(true);
  });
  it('aguardando o contratante nunca conclui direto (§11.11)', () => {
    const c = card({ tipo: 'faturamentoCard', baseEstado: 'aguardandoInput', prazo: undefined });
    expect(podeConcluir(c)).toBe(false);
  });
});

describe('sub-workflow da ASF (§11.3)', () => {
  it('avança e retrocede pela ordem', () => {
    expect(asfNext(undefined)).toBe(ASF_FLOW[0]);
    expect(asfNext('enviadoADaniela')).toBe('correcoesSolicitadas');
    expect(asfPrev('emCorrecaoPeloRodrigo')).toBe('correcoesSolicitadas');
    expect(asfNext('aprovado')).toBeUndefined();
  });
  it('só aprovado libera as etapas seguintes', () => {
    expect(asfAprovado('enviadoADaniela')).toBe(false);
    expect(asfAprovado('aprovado')).toBe(true);
  });
});

describe('notas fracionadas (§11.5)', () => {
  it('divide pelo teto arredondando para cima', () => {
    expect(notasFracionadas(50000, 17600)).toEqual({ quantidade: 3, valorPorNota: 16666.67 });
    expect(notasFracionadas(10000, 17600)).toEqual({ quantidade: 1, valorPorNota: 10000 });
  });
});

describe('validação de 2 casas decimais (§11.4)', () => {
  it('aceita até duas casas e rejeita mais', () => {
    expect(maxDuasCasas('12')).toBe(true);
    expect(maxDuasCasas('12.34')).toBe(true);
    expect(maxDuasCasas('12,34')).toBe(true);
    expect(maxDuasCasas('12.345')).toBe(false);
  });
});

describe('saída do contrato social (§11.7)', () => {
  it('gera card de R$50 no mês seguinte, não crítico', () => {
    const c = cardDevolucaoContratoSocial('2026-07-20', 'asf');
    expect(c.data).toBe('2026-08-01');
    expect(c.tipo).toBe('cardPagamento');
    expect(c.critico).toBe(false);
    expect(c.projetoId).toBe('asf');
  });
});
