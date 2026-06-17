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
import { podeConcluir, bloqueioConclusao, medicoPronto, loteProgresso } from '../stateMachine';
// (bloqueioConclusao cobre lote, contrato social e aguardando)
import type { CalendarItem, MedicoCard } from '../types';

function lote(extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'lotePagamento:asf:2026-07',
    titulo: 'Pagamentos do projeto ASF',
    tipo: 'lotePagamento',
    regraOrigem: '',
    competencia: '2026-07',
    prazo: '2026-07-10',
    baseEstado: 'pendente',
    isManual: false,
    ...extra,
  };
}
function medico(extra: Partial<MedicoCard> = {}): MedicoCard {
  return { id: 'm1', nome: 'Dr. X', vinculo: 'PJ', ...extra };
}

describe('lote de pagamento e cards de médico (§4.3, §11.2)', () => {
  it('lote sem médicos não conclui e explica o bloqueio', () => {
    const c = lote();
    expect(podeConcluir(c)).toBe(false);
    expect(bloqueioConclusao(c)).toMatch(/Adicione os cards/);
  });
  it('card de médico só fica pronto com planilha + PIX (SERGES Connect não bloqueia)', () => {
    expect(medicoPronto(medico())).toBe(false);
    expect(medicoPronto(medico({ anexoPresente: true }))).toBe(false);
    expect(medicoPronto(medico({ anexoPresente: true, pixConferido: true }))).toBe(true);
    expect(medicoPronto(medico({ anexoPresente: true, pixConferido: true, sergesConnect: 'nada' }))).toBe(true);
  });
  it('lote conclui só quando todos os médicos estão prontos e aprovados', () => {
    const incompleto = lote({ medicos: [medico({ anexoPresente: true, pixConferido: true })] }); // falta aprovado
    expect(podeConcluir(incompleto)).toBe(false);
    expect(loteProgresso(incompleto)).toEqual({ ok: 0, total: 1 });
    const ok = lote({ medicos: [medico({ anexoPresente: true, pixConferido: true, aprovado: true })] });
    expect(podeConcluir(ok)).toBe(true);
    expect(loteProgresso(ok)).toEqual({ ok: 1, total: 1 });
  });
  it('aguardando o contratante nunca conclui direto (§11.11)', () => {
    const c = lote({ tipo: 'faturamentoCard', baseEstado: 'aguardandoInput', prazo: undefined });
    expect(podeConcluir(c)).toBe(false);
  });
});

describe('alteração do contrato social', () => {
  const base = (extra: Partial<CalendarItem> = {}): CalendarItem => ({
    id: 'fixa:contratoSocialContabilidade:2026-07',
    titulo: 'Alteração do contrato social',
    tipo: 'fixa',
    regraOrigem: '',
    competencia: '2026-07',
    prazo: '2026-07-20',
    baseEstado: 'pendente',
    isManual: false,
    ...extra,
  });
  it('bloqueia sem confirmação dos escalistas', () => {
    expect(bloqueioConclusao(base())).toMatch(/escalistas/);
  });
  it('bloqueia enquanto entrantes não têm procuração + boleto', () => {
    const item = base({
      contratoSocial: {
        confirmacaoEscalistas: true,
        entrantes: [
          { id: 'a', nome: 'Dr A', procuracao: true, boleto: true },
          { id: 'b', nome: 'Dr B', procuracao: true },
        ],
      },
    });
    expect(bloqueioConclusao(item)).toMatch(/1 de 2/);
    expect(podeConcluir(item)).toBe(false);
  });
  it('conclui quando confirmado e todos os entrantes completos', () => {
    const item = base({
      contratoSocial: {
        confirmacaoEscalistas: true,
        entrantes: [{ id: 'a', nome: 'Dr A', procuracao: true, boleto: true }],
        saintes: [{ id: 's', nome: 'Dr S' }],
      },
    });
    expect(podeConcluir(item)).toBe(true);
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
    expect(c.critico).toBe(false);
    expect(c.projetoId).toBe('asf');
  });
});
