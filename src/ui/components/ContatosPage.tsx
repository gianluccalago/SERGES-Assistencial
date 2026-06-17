import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { Contato, ContatoCategoria } from '../../domain/types';
import { whatsappLink, mailtoLink, outlookWebLink } from '../contatoLinks';

const CATEGORIAS: ContatoCategoria[] = ['contratante', 'interno', 'contabilidade'];
const CAT_LABEL: Record<ContatoCategoria, string> = {
  contratante: 'Contratantes',
  interno: 'Internos',
  contabilidade: 'Contabilidade',
};

function novoContato(): Contato {
  return { id: `c-${crypto.randomUUID().slice(0, 8)}`, nome: '', categoria: 'contratante', projetos: [] };
}

export function ContatosPage() {
  const store = useStore();
  const [editing, setEditing] = useState<Contato | null>(null);
  const [busca, setBusca] = useState('');

  const porCategoria = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = store.state.contatos.filter(
      (c) => !q || (c.nome + ' ' + (c.papel ?? '') + ' ' + (c.email ?? '') + ' ' + (c.telefone ?? '')).toLowerCase().includes(q),
    );
    return CATEGORIAS.map((cat) => ({ cat, itens: filtrados.filter((c) => c.categoria === cat) }));
  }, [store.state.contatos, busca]);

  return (
    <div className="grid gap-[var(--spacing-24)] lg:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[length:var(--text-heading)]">Contatos</h2>
          <button className="btn-primary" onClick={() => setEditing(novoContato())}>
            Novo contato
          </button>
        </div>
        <input className="input mb-[var(--spacing-16)]" placeholder="Buscar contato…" value={busca} onChange={(e) => setBusca(e.target.value)} />

        {porCategoria.map(({ cat, itens }) =>
          itens.length === 0 ? null : (
            <div key={cat} className="mb-[var(--spacing-20)]">
              <div className="label mb-2 uppercase">{CAT_LABEL[cat]}</div>
              <div className="space-y-2">
                {itens.map((c) => (
                  <div key={c.id} className="card p-[var(--spacing-16)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--color-ink)]">
                          {c.nome}
                          {c.escalonamento && (
                            <span className="ml-2 text-[length:var(--text-caption)] text-[var(--color-serges-blue)]">escalonamento</span>
                          )}
                        </div>
                        <div className="label">
                          {c.papel}
                          {c.telefone ? ` · ${c.telefone}` : ''}
                          {c.email ? ` · ${c.email}` : ''}
                        </div>
                        {c.projetos.length > 0 && (
                          <div className="label mt-0.5">
                            Projetos: {c.projetos.map((pid) => store.state.projects.find((p) => p.id === pid)?.nome ?? pid).join(', ')}
                          </div>
                        )}
                        {c.notas && <div className="label mt-0.5">{c.notas}</div>}
                      </div>
                      <button className="btn-ghost shrink-0" onClick={() => setEditing({ ...c })}>
                        Editar
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.telefone && (
                        <a className="btn-secondary" href={whatsappLink(c.telefone)} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      )}
                      {c.email && (
                        <>
                          <a className="btn-secondary" href={mailtoLink(c.email)}>
                            E-mail
                          </a>
                          <a className="btn-secondary" href={outlookWebLink(c.email)} target="_blank" rel="noreferrer">
                            Outlook web
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
      </div>

      {editing && (
        <ContatoForm
          contato={editing}
          onCancel={() => setEditing(null)}
          onSave={(c) => {
            store.upsertContato(c);
            setEditing(null);
          }}
          onDelete={
            store.state.contatos.some((c) => c.id === editing.id)
              ? () => {
                  store.removeContato(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function ContatoForm({
  contato,
  onSave,
  onCancel,
  onDelete,
}: {
  contato: Contato;
  onSave: (c: Contato) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const store = useStore();
  const [draft, setDraft] = useState<Contato>(contato);
  const set = <K extends keyof Contato>(k: K, v: Contato[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function toggleProjeto(pid: string) {
    setDraft((d) => ({
      ...d,
      projetos: d.projetos.includes(pid) ? d.projetos.filter((x) => x !== pid) : [...d.projetos, pid],
    }));
  }

  return (
    <div className="card h-fit space-y-3 p-[var(--spacing-20)]">
      <h3 className="text-[length:var(--text-subheading)]">{contato.nome ? `Editar ${contato.nome}` : 'Novo contato'}</h3>
      <Field label="Nome">
        <input className="input" value={draft.nome} onChange={(e) => set('nome', e.target.value)} />
      </Field>
      <Field label="Papel">
        <input className="input" value={draft.papel ?? ''} onChange={(e) => set('papel', e.target.value)} />
      </Field>
      <Field label="Categoria">
        <select className="select" value={draft.categoria} onChange={(e) => set('categoria', e.target.value as ContatoCategoria)}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CAT_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Telefone">
        <input className="input" value={draft.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
      </Field>
      <Field label="E-mail">
        <input className="input" value={draft.email ?? ''} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label="Notas">
        <textarea className="input" rows={2} value={draft.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-[length:var(--text-label)]">
        <input type="checkbox" checked={!!draft.escalonamento} onChange={(e) => set('escalonamento', e.target.checked)} />
        Contato de escalonamento
      </label>
      <div>
        <span className="label mb-1 block uppercase">Projetos associados</span>
        <div className="flex flex-wrap gap-1">
          {store.state.projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className="pill"
              data-active={draft.projetos.includes(p.id)}
              onClick={() => toggleProjeto(p.id)}
            >
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button className="btn-primary" disabled={!draft.nome} onClick={() => onSave(draft)}>
          Salvar
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        {onDelete && (
          <button className="btn-ghost text-[var(--color-overdue)]" onClick={onDelete}>
            Excluir
          </button>
        )}
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
