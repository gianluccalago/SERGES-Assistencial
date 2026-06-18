import { useState, type ReactNode } from 'react';
import type { Anexo, ContatoPref } from '../../comercial/model';
import { whatsappLink, mailtoLink, outlookWebLink } from '../contatoLinks';

export function Modal({ titulo, onClose, children, footer }: { titulo: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-[5vh]" onClick={onClose}>
      <div className="card w-full max-w-[560px] p-[var(--spacing-24)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[length:var(--text-subheading)]">{titulo}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function fmtMoeda(v?: number): string {
  return v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Editor de anexos por link (URL do SharePoint/OneDrive/portal). */
export function AnexosEditor({ anexos, onChange }: { anexos: Anexo[]; onChange: (a: Anexo[]) => void }) {
  const [rotulo, setRotulo] = useState('');
  const [url, setUrl] = useState('');
  return (
    <div>
      <span className="label mb-1 block">Anexos e documentos (por link)</span>
      <div className="space-y-1.5">
        {anexos.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-1.5">
            <span className="min-w-0 truncate text-[length:var(--text-label)]">{a.rotulo}</span>
            <span className="flex shrink-0 gap-1">
              <a className="btn-secondary" href={a.url} target="_blank" rel="noreferrer">Abrir</a>
              <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => onChange(anexos.filter((x) => x.id !== a.id))}>remover</button>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="input min-w-[120px] flex-1" placeholder="Rótulo (ex.: Edital)" value={rotulo} onChange={(e) => setRotulo(e.target.value)} />
        <input className="input min-w-[160px] flex-[2]" placeholder="Colar link (SharePoint/portal)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="btn-secondary"
          disabled={!rotulo.trim() || !url.trim()}
          onClick={() => {
            onChange([...anexos, { id: `ax-${Math.random().toString(36).slice(2, 8)}`, rotulo: rotulo.trim(), url: url.trim() }]);
            setRotulo('');
            setUrl('');
          }}
        >
          Adicionar
        </button>
      </div>
      <p className="label mt-1">Anexos são por link (sem backend). Upload de arquivo grande não é suportado.</p>
    </div>
  );
}

export function ContatoFields({ contato, onChange }: { contato: ContatoPref; onChange: (c: ContatoPref) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Contato (nome)">
        <input className="input" value={contato.nome ?? ''} onChange={(e) => onChange({ ...contato, nome: e.target.value })} />
      </Field>
      <Field label="Telefone">
        <input className="input" value={contato.telefone ?? ''} onChange={(e) => onChange({ ...contato, telefone: e.target.value })} />
      </Field>
      <Field label="E-mail">
        <input className="input" value={contato.email ?? ''} onChange={(e) => onChange({ ...contato, email: e.target.value })} />
      </Field>
    </div>
  );
}

export function ContatoAcoes({ contato }: { contato: ContatoPref }) {
  if (!contato.telefone && !contato.email) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {contato.nome && <span className="label mr-1">{contato.nome}</span>}
      {contato.telefone && (
        <a className="btn-secondary" href={whatsappLink(contato.telefone)} target="_blank" rel="noreferrer">WhatsApp</a>
      )}
      {contato.email && (
        <>
          <a className="btn-secondary" href={mailtoLink(contato.email)}>E-mail</a>
          <a className="btn-secondary" href={outlookWebLink(contato.email)} target="_blank" rel="noreferrer">Outlook</a>
        </>
      )}
    </div>
  );
}
