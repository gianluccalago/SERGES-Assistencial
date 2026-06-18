import { useState } from 'react';
import { useComercial } from '../../comercial/store';
import {
  type Contrato,
  type ContratoStatus,
  type Modalidade,
  MODALIDADE_LABEL,
  diasAte,
} from '../../comercial/model';
import { todayISO } from '../format';
import { Modal, Field, AnexosEditor, ContatoFields, ContatoAcoes, fmtMoeda } from './shared';

const STATUS_LABEL: Record<ContratoStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo (rodízio)',
  suspenso: 'Suspenso (empenho esgotou)',
  vencido: 'Vencido',
};

export function ContratoDetail({ contrato, onClose }: { contrato: Contrato; onClose: () => void }) {
  const c = useComercial();
  const [draft, setDraft] = useState<Contrato>(contrato);

  function patch(p: Partial<Contrato>) {
    const next = { ...draft, ...p };
    setDraft(next);
    c.upsertContrato(next);
  }

  const exigeMotivo = draft.status !== 'ativo';
  const dias = draft.fimVencimento ? diasAte(draft.fimVencimento, todayISO()) : undefined;

  return (
    <Modal
      titulo={draft.titulo || (draft.cidade ? `${draft.cidade}/${draft.uf}` : 'Novo contrato')}
      onClose={onClose}
      footer={
        <button
          className="btn-ghost ml-auto text-[var(--color-overdue)]"
          onClick={() => {
            c.removeContrato(draft.id);
            onClose();
          }}
        >
          Excluir contrato
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-[var(--color-serges-blue-tint)] border-[var(--color-serges-blue)] text-[var(--color-serges-blue)]">{STATUS_LABEL[draft.status]}</span>
        {draft.valor != null && <span className="chip">{fmtMoeda(draft.valor)}</span>}
        {dias != null && dias >= 0 && dias <= 90 && (
          <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Vence em {dias}d</span>
        )}
        {dias != null && dias < 0 && <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Vencido</span>}
      </div>

      <Field label="Título (hospital/UPA/UBS)"><input className="input" placeholder="Ex.: UPA de…" value={draft.titulo ?? ''} onChange={(e) => patch({ titulo: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade"><input className="input" value={draft.cidade} onChange={(e) => patch({ cidade: e.target.value })} /></Field>
        <Field label="UF"><input className="input" maxLength={2} value={draft.uf} onChange={(e) => patch({ uf: e.target.value.toUpperCase() })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de serviço"><input className="input" value={draft.tipoServico ?? ''} onChange={(e) => patch({ tipoServico: e.target.value })} /></Field>
        <Field label="Valor"><input className="input" inputMode="decimal" value={draft.valor ?? ''} onChange={(e) => patch({ valor: e.target.value ? Number(e.target.value.replace(',', '.')) : undefined })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início"><input className="input" type="date" value={draft.inicio ?? ''} onChange={(e) => patch({ inicio: e.target.value })} /></Field>
        <Field label="Fim / vencimento"><input className="input" type="date" value={draft.fimVencimento ?? ''} onChange={(e) => patch({ fimVencimento: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Modalidade">
          <select className="select" value={draft.modalidade ?? ''} onChange={(e) => patch({ modalidade: (e.target.value || undefined) as Modalidade | undefined })}>
            <option value="">—</option>
            {(Object.keys(MODALIDADE_LABEL) as Modalidade[]).map((m) => <option key={m} value={m}>{MODALIDADE_LABEL[m]}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="select" value={draft.status} onChange={(e) => patch({ status: e.target.value as ContratoStatus })}>
            {(Object.keys(STATUS_LABEL) as ContratoStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      </div>

      {exigeMotivo && (
        <Field label="Motivo (inativo / suspenso / vencido)">
          <input className="input" value={draft.motivo ?? ''} onChange={(e) => patch({ motivo: e.target.value })} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Link do edital"><input className="input" placeholder="https://" value={draft.linkEdital ?? ''} onChange={(e) => patch({ linkEdital: e.target.value })} /></Field>
        <Field label="Link do contrato"><input className="input" placeholder="https://" value={draft.linkContrato ?? ''} onChange={(e) => patch({ linkContrato: e.target.value })} /></Field>
      </div>

      <AnexosEditor anexos={draft.anexos} onChange={(anexos) => patch({ anexos })} prefixo={`contratos/${draft.id}`} />

      <div>
        <span className="label mb-1 block">Contato da prefeitura</span>
        <ContatoFields contato={draft.contato} onChange={(contato) => patch({ contato })} />
        <div className="mt-2"><ContatoAcoes contato={draft.contato} /></div>
      </div>
    </Modal>
  );
}
