import { useState } from 'react';
import { useStore } from '../../state/store';
import type { Contato, ContatoCategoria } from '../../domain/types';
import { whatsappLink, mailtoLink, outlookWebLink } from '../contatoLinks';

const CATEGORIAS: ContatoCategoria[] = ['contratante', 'interno', 'contabilidade'];
const CAT_LABEL: Record<ContatoCategoria, string> = {
  contratante: 'Contratante',
  interno: 'Interno',
  contabilidade: 'Contabilidade',
};

function novoContato(over: Partial<Contato> = {}): Contato {
  return { id: `c-${crypto.randomUUID().slice(0, 8)}`, nome: '', categoria: 'contratante', projetos: [], ...over };
}

export function ContatosPage() {
  const store = useStore();
  const [editing, setEditing] = useState<Contato | null>(null);
  const [busca, setBusca] = useState('');

  const q = busca.trim().toLowerCase();
  const filtra = (c: Contato) =>
    !q || (c.nome + ' ' + (c.papel ?? '') + ' ' + (c.email ?? '') + ' ' + (c.telefone ?? '')).toLowerCase().includes(q);

  const internos = store.state.contatos.filter((c) => c.categoria === 'interno' && filtra(c));

  // Seções por projeto (na ordem dos projetos), com os contatos não-internos.
  const naoInternos = store.state.contatos.filter((c) => c.categoria !== 'interno' && filtra(c));
  const secoesProjeto = store.state.projects
    .map((p) => ({ projeto: p, contatos: naoInternos.filter((c) => c.projetos.includes(p.id)) }))
    .filter((s) => s.contatos.length > 0);
  const semProjeto = naoInternos.filter((c) => c.projetos.length === 0);

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="mb-[var(--spacing-16)] flex flex-wrap items-center gap-3">
        <input className="input flex-1 min-w-[200px]" placeholder="Buscar contato…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn-primary" onClick={() => setEditing(novoContato())}>
          + Novo contato
        </button>
      </div>

      {/* SERGES — internos, antes de tudo */}
      <Secao
        titulo="SERGES — equipe interna"
        onAdd={() => setEditing(novoContato({ categoria: 'interno' }))}
      >
        {internos.map((c) => (
          <ContatoRow key={c.id} c={c} onEdit={() => setEditing({ ...c })} />
        ))}
        {internos.length === 0 && <Vazio />}
      </Secao>

      {/* Um bloco por projeto */}
      {secoesProjeto.map(({ projeto, contatos }) => (
        <Secao
          key={projeto.id}
          titulo={projeto.nome}
          onAdd={() => setEditing(novoContato({ categoria: 'contratante', projetos: [projeto.id] }))}
        >
          {contatos.map((c) => (
            <ContatoRow key={c.id + projeto.id} c={c} onEdit={() => setEditing({ ...c })} />
          ))}
        </Secao>
      ))}

      {/* Contatos sem projeto (ex.: contabilidade geral) */}
      {semProjeto.length > 0 && (
        <Secao titulo="Outros (sem projeto)" onAdd={() => setEditing(novoContato({ categoria: 'contabilidade' }))}>
          {semProjeto.map((c) => (
            <ContatoRow key={c.id} c={c} onEdit={() => setEditing({ ...c })} />
          ))}
        </Secao>
      )}

      {editing && (
        <ContatoModal
          contato={editing}
          onClose={() => setEditing(null)}
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

function Secao({ titulo, onAdd, children }: { titulo: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section className="mb-[var(--spacing-24)]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[length:var(--text-subheading)]">{titulo}</h2>
        <button className="btn-ghost" onClick={onAdd}>
          + Adicionar
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Vazio() {
  return <div className="label">Nenhum contato.</div>;
}

function ContatoRow({ c, onEdit }: { c: Contato; onEdit: () => void }) {
  return (
    <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-[var(--spacing-16)]">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[var(--color-ink)]">
          {c.nome}
          {c.escalonamento && (
            <span className="ml-2 text-[length:var(--text-caption)] text-[var(--color-serges-blue)]">escalonamento</span>
          )}
        </div>
        <div className="label">
          {c.papel ?? CAT_LABEL[c.categoria]}
          {c.telefone ? ` · ${c.telefone}` : ''}
          {c.email ? ` · ${c.email}` : ''}
        </div>
        {c.notas && <div className="label mt-0.5">{c.notas}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1">
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
              Outlook
            </a>
          </>
        )}
        <button className="btn-ghost" onClick={onEdit}>
          Editar
        </button>
      </div>
    </div>
  );
}

function ContatoModal({
  contato,
  onSave,
  onClose,
  onDelete,
}: {
  contato: Contato;
  onSave: (c: Contato) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const store = useStore();
  const [draft, setDraft] = useState<Contato>(contato);
  const set = <K extends keyof Contato>(k: K, v: Contato[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleProjeto = (pid: string) =>
    setDraft((d) => ({
      ...d,
      projetos: d.projetos.includes(pid) ? d.projetos.filter((x) => x !== pid) : [...d.projetos, pid],
    }));

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-[6vh]" onClick={onClose}>
      <div className="card w-full max-w-[480px] space-y-3 p-[var(--spacing-24)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[length:var(--text-subheading)]">{contato.nome ? `Editar ${contato.nome}` : 'Novo contato'}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        <Field label="Nome">
          <input className="input" autoFocus value={draft.nome} onChange={(e) => set('nome', e.target.value)} />
        </Field>
        <Field label="Papel">
          <input className="input" value={draft.papel ?? ''} onChange={(e) => set('papel', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select className="select" value={draft.categoria} onChange={(e) => set('categoria', e.target.value as ContatoCategoria)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{CAT_LABEL[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Telefone">
            <input className="input" value={draft.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
          </Field>
        </div>
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
          <span className="label mb-1 block">Projetos associados</span>
          <div className="flex flex-wrap gap-1">
            {store.state.projects.map((p) => (
              <button key={p.id} type="button" className="seg-btn" data-active={draft.projetos.includes(p.id)} onClick={() => toggleProjeto(p.id)}>
                {p.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn-primary" disabled={!draft.nome} onClick={() => onSave(draft)}>
            Salvar
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          {onDelete && (
            <button className="btn-ghost ml-auto text-[var(--color-overdue)]" onClick={onDelete}>
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
      <span className="label mb-1 block">{label}</span>
      {children}
    </label>
  );
}
