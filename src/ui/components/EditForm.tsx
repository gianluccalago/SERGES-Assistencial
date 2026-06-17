import { useState } from 'react';
import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';

// Editar campos de uma obrigação (§4.5). Em obrigações geradas grava override
// dos campos alterados; em manuais altera o registro.
export function EditForm({ ro, onClose }: { ro: ResolvedObligation; onClose: () => void }) {
  const store = useStore();
  const { item } = ro;
  const [titulo, setTitulo] = useState(item.titulo);
  const [projetoId, setProjetoId] = useState(item.projetoId ?? '');
  const [responsavel, setResponsavel] = useState(item.responsavel ?? '');
  const [prazo, setPrazo] = useState(item.prazo ?? '');
  const [notas, setNotas] = useState(item.notas ?? '');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-[460px] space-y-3 p-[var(--spacing-20)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[length:var(--text-subheading)]">Editar obrigação</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        <Field label="Título">
          <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
        <Field label="Projeto">
          <select className="select" value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            <option value="">—</option>
            {store.state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsável / escalista">
          <input className="input" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </Field>
        <Field label="Prazo">
          <input className="input" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </Field>
        <Field label="Notas">
          <textarea className="input" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Field>

        <div className="flex gap-2 pt-1">
          <button
            className="btn-primary"
            disabled={!titulo}
            onClick={() => {
              store.editItem(item, {
                titulo,
                projetoId: projetoId || undefined,
                responsavel: responsavel || undefined,
                prazo: prazo || undefined,
                notas: notas || undefined,
              });
              onClose();
            }}
          >
            Salvar
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
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
