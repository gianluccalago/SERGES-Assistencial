import { useState } from 'react';
import { useStore } from '../../state/store';
import type { DependenciaFaturamento, Project } from '../../domain/types';
import { DEP_LABEL } from '../format';

const DEPENDENCIAS: DependenciaFaturamento[] = [
  'nenhuma',
  'fixo',
  'empenho',
  'ordemDeCompra',
  'validacaoContratante',
  'relatorioContratante',
  'escalista',
];

function emptyProject(): Project {
  return {
    id: '',
    nome: '',
    ativo: true,
    diaPagamento: 15,
    afericao: '1-31',
    dependenciaFaturamento: 'nenhuma',
    contratoSocialObrigatorio: false,
    escalista: '',
  };
}

export function ProjectsAdmin() {
  const store = useStore();
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <div className="grid gap-[var(--spacing-24)] lg:grid-cols-[1fr_380px]">
      <div className="space-y-px">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[length:var(--text-subheading)]">Projetos</h2>
          <button className="btn-primary" onClick={() => setEditing(emptyProject())}>
            Novo projeto
          </button>
        </div>
        {store.state.projects.map((p) => (
          <div key={p.id} className="surface hairline flex items-center gap-4 p-[var(--spacing-16)]">
            <div className="min-w-0 flex-1">
              <div className={p.ativo ? 'text-[var(--color-bone)]' : 'text-[var(--color-ash)] opacity-50'}>
                {p.nome} {!p.ativo && '· inativo'}
              </div>
              <div className="label mt-1">
                Pgto dia {p.diaPagamento} · aferição {p.afericao} · {DEP_LABEL[p.dependenciaFaturamento]}
                {p.escalista ? ` · ${p.escalista}` : ''}
                {p.contratoSocialObrigatorio ? ' · contrato social' : ''}
              </div>
            </div>
            <button className="btn-secondary" data-active onClick={() => setEditing({ ...p })}>
              Editar
            </button>
            <button className="btn-secondary" onClick={() => store.setProjectAtivo(p.id, !p.ativo)}>
              {p.ativo ? 'Inativar' : 'Ativar'}
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <ProjectForm
          project={editing}
          onCancel={() => setEditing(null)}
          onSave={(p) => {
            store.upsertProject(p);
            setEditing(null);
          }}
          onDelete={
            store.state.projects.some((p) => p.id === editing.id)
              ? () => {
                  store.removeProject(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function ProjectForm({
  project,
  onSave,
  onCancel,
  onDelete,
}: {
  project: Project;
  onSave: (p: Project) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Project>(project);
  const isNew = !project.id;

  function set<K extends keyof Project>(key: K, value: Project[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '');

  return (
    <div className="surface hairline h-fit space-y-3 p-[var(--spacing-20)]">
      <h3>{isNew ? 'Novo projeto' : `Editar ${project.nome}`}</h3>

      <Field label="Nome">
        <input
          className="input"
          value={draft.nome}
          onChange={(e) => {
            const nome = e.target.value;
            set('nome', nome);
            if (isNew) set('id', slug(nome));
          }}
        />
      </Field>
      <Field label="Dia de pagamento">
        <input
          className="input"
          type="number"
          min={1}
          max={31}
          value={draft.diaPagamento}
          onChange={(e) => set('diaPagamento', Number(e.target.value))}
        />
      </Field>
      <Field label="Dia-limite de lançamento (opcional)">
        <input
          className="input"
          type="number"
          min={1}
          max={31}
          value={draft.diaLancamento ?? ''}
          onChange={(e) => set('diaLancamento', e.target.value ? Number(e.target.value) : undefined)}
        />
      </Field>
      <Field label="Aferição">
        <input className="input" value={draft.afericao} onChange={(e) => set('afericao', e.target.value)} />
      </Field>
      <Field label="Dependência de faturamento">
        <select
          className="input"
          value={draft.dependenciaFaturamento}
          onChange={(e) => set('dependenciaFaturamento', e.target.value as DependenciaFaturamento)}
        >
          {DEPENDENCIAS.map((d) => (
            <option key={d} value={d}>
              {DEP_LABEL[d]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Escalista">
        <input className="input" value={draft.escalista ?? ''} onChange={(e) => set('escalista', e.target.value)} />
      </Field>
      <label className="flex items-center gap-3 text-[length:var(--text-caption)]">
        <input
          type="checkbox"
          checked={draft.contratoSocialObrigatorio}
          onChange={(e) => set('contratoSocialObrigatorio', e.target.checked)}
        />
        Contrato social obrigatório
      </label>
      <label className="flex items-center gap-3 text-[length:var(--text-caption)]">
        <input type="checkbox" checked={draft.ativo} onChange={(e) => set('ativo', e.target.checked)} />
        Ativo
      </label>

      <div className="flex gap-2 pt-2">
        <button
          className="btn-primary"
          disabled={!draft.nome || !draft.id}
          onClick={() => onSave(draft)}
        >
          Salvar
        </button>
        <button className="btn-secondary" data-active onClick={onCancel}>
          Cancelar
        </button>
        {onDelete && (
          <button className="btn-secondary" onClick={onDelete}>
            Excluir
          </button>
        )}
      </div>
      <p className="label">Alterar um projeto recalcula o calendário automaticamente.</p>
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
