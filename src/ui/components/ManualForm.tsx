import { useState } from 'react';
import { useStore } from '../../state/store';
import type { ManualObligation, ObligationTipo } from '../../domain/types';
import { TIPO_LABEL, todayISO } from '../format';

const TIPOS: ObligationTipo[] = [
  'evento',
  'lotePagamento',
  'faturamentoIniciar',
  'faturamentoCard',
  'fixa',
  'apresentacao',
  'fechamento',
];

// Presets dos eventos descritos na spec (4.4), como atalhos de preenchimento.
const PRESETS: Array<{ id: string; titulo: string; notas: string; critico: boolean }> = [
  {
    id: 'drLuiz',
    titulo: 'Pagamento Dr. Luiz Marino (HRL UTI)',
    notas: 'D+5 após o fim do plantão, com nota fiscal e 11% de desconto.',
    critico: true,
  },
  {
    id: 'boleto',
    titulo: 'Boleto da cota do contrato social',
    notas: 'Vence 3 dias após o envio do card de procuração.',
    critico: true,
  },
  {
    id: 'saida',
    titulo: 'Card de pagamento — saída do contrato social (R$ 50)',
    notas: 'Sem prazo crítico; pode ir para o mês seguinte.',
    critico: false,
  },
];

function novaManual(): ManualObligation {
  return {
    id: `manual:${crypto.randomUUID()}`,
    titulo: '',
    data: todayISO(),
    tipo: 'evento',
    estado: 'pendente',
  };
}

export function ManualForm({
  editId,
  onClose,
}: {
  editId?: string;
  onClose: () => void;
}) {
  const store = useStore();
  const existing = editId ? store.state.manualObligations.find((m) => m.id === editId) : undefined;
  const [draft, setDraft] = useState<ManualObligation>(existing ? { ...existing } : novaManual());

  function set<K extends keyof ManualObligation>(key: K, value: ManualObligation[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-[480px] space-y-3 overflow-y-auto bg-[var(--color-surface)] p-[var(--spacing-24)] shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[length:var(--text-heading)]">{existing ? 'Editar obrigação' : 'Nova obrigação'}</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {!existing && (
          <div>
            <span className="label mb-1 block uppercase">Atalhos de evento</span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="chip hover:border-[var(--color-serges-blue)]"
                  onClick={() => setDraft((d) => ({ ...d, titulo: p.titulo, notas: p.notas, tipo: 'evento', critico: p.critico }))}
                >
                  {p.titulo.length > 28 ? p.titulo.slice(0, 28) + '…' : p.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Título">
          <input className="input" value={draft.titulo} onChange={(e) => set('titulo', e.target.value)} />
        </Field>
        <Field label="Data">
          <input className="input" type="date" value={draft.data} onChange={(e) => set('data', e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select className="select" value={draft.tipo} onChange={(e) => set('tipo', e.target.value as ObligationTipo)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Projeto (opcional)">
          <select
            className="select"
            value={draft.projetoId ?? ''}
            onChange={(e) => set('projetoId', e.target.value || undefined)}
          >
            <option value="">—</option>
            {store.state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsável">
          <input className="input" value={draft.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value || undefined)} />
        </Field>
        <Field label="Notas">
          <textarea className="input" rows={3} value={draft.notas ?? ''} onChange={(e) => set('notas', e.target.value || undefined)} />
        </Field>

        <div className="flex gap-2 pt-2">
          <button
            className="btn-primary"
            disabled={!draft.titulo || !draft.data}
            onClick={() => {
              if (existing) store.updateManual(draft);
              else store.addManual(draft);
              onClose();
            }}
          >
            {existing ? 'Salvar' : 'Criar obrigação'}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          {existing && (
            <button
              className="btn-ghost text-[var(--color-overdue)]"
              onClick={() => {
                store.removeManual(existing.id);
                onClose();
              }}
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block uppercase">{label}</span>
      {children}
    </label>
  );
}
