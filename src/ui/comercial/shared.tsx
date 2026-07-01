import { useState, type ReactNode } from 'react';
import type { Anexo, ContatoPref } from '../../comercial/model';
import { whatsappLink, mailtoLink, outlookWebLink } from '../contatoLinks';
import { uploadArquivo, abrirArquivo, removerArquivo, MAX_MB } from '../../lib/storage';

export function Modal({ titulo, onClose, children, footer }: { titulo: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-[5vh]" onClick={onClose}>
      <div className="card w-full max-w-[560px] p-[var(--spacing-24)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[length:var(--text-subheading)]">{titulo}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
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

/** Botão de upload de um único arquivo. Devolve caminho+nome no Storage. */
export function AnexoUploadButton({
  prefixo,
  onUploaded,
  label = 'Enviar arquivo',
}: {
  prefixo: string;
  onUploaded: (r: { path: string; nome: string }) => void;
  label?: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <>
      <label className="btn-secondary cursor-pointer">
        {enviando ? 'Enviando…' : label}
        <input
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
          disabled={enviando}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setErro(null);
            setEnviando(true);
            try {
              onUploaded(await uploadArquivo(prefixo, f));
            } catch (err) {
              setErro(err instanceof Error ? err.message : 'Falha no upload.');
            } finally {
              setEnviando(false);
            }
          }}
        />
      </label>
      {erro && <span className="label text-[var(--color-overdue)]">{erro}</span>}
    </>
  );
}

/** Abre um anexo (arquivo no Storage ou link externo). */
export function abrirAnexo(a: Anexo, download = false) {
  if (a.path) {
    void abrirArquivo(a.path, download);
  } else if (a.url) {
    window.open(a.url, '_blank', 'noopener');
  }
}

/**
 * Editor de anexos: upload de arquivo real (Supabase Storage) OU link externo
 * (SharePoint/OneDrive/portal) como alternativa. `prefixo` organiza o caminho.
 */
export function AnexosEditor({
  anexos,
  onChange,
  prefixo,
}: {
  anexos: Anexo[];
  onChange: (a: Anexo[]) => void;
  prefixo: string;
}) {
  const [rotulo, setRotulo] = useState('');
  const [url, setUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(file: File) {
    setErro(null);
    setEnviando(true);
    try {
      const { path, nome } = await uploadArquivo(prefixo, file);
      onChange([...anexos, { id: `ax-${crypto.randomUUID().slice(0, 8)}`, rotulo: nome, path, nome }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no upload.');
    } finally {
      setEnviando(false);
    }
  }

  function remover(a: Anexo) {
    if (a.path) void removerArquivo(a.path);
    onChange(anexos.filter((x) => x.id !== a.id));
  }

  return (
    <div>
      <span className="label mb-1 block">Anexos e documentos</span>
      <div className="space-y-1.5">
        {anexos.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-[length:var(--text-label)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-ink-faint)]">
                {a.path ? (
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                ) : (
                  <>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </>
                )}
              </svg>
              <span className="truncate">{a.rotulo}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button className="btn-secondary" onClick={() => abrirAnexo(a)}>Abrir</button>
              {a.path && <button className="btn-ghost" onClick={() => abrirAnexo(a, true)}>baixar</button>}
              <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => remover(a)}>remover</button>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="btn-secondary cursor-pointer">
          {enviando ? 'Enviando…' : 'Enviar arquivo'}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void enviar(f);
              e.target.value = '';
            }}
          />
        </label>
        <span className="label">ou link externo:</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="input min-w-[120px] flex-1" placeholder="Rótulo (ex.: Edital)" value={rotulo} onChange={(e) => setRotulo(e.target.value)} />
        <input className="input min-w-[160px] flex-[2]" placeholder="Colar link (SharePoint/portal)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="btn-secondary"
          disabled={!rotulo.trim() || !url.trim()}
          onClick={() => {
            onChange([...anexos, { id: `ax-${crypto.randomUUID().slice(0, 8)}`, rotulo: rotulo.trim(), url: url.trim() }]);
            setRotulo('');
            setUrl('');
          }}
        >
          Adicionar link
        </button>
      </div>
      {erro && <p className="label mt-1 text-[var(--color-overdue)]">{erro}</p>}
      <p className="label mt-1">Arquivos até {MAX_MB} MB (PDF, imagens, Office). Acima disso, use um link externo.</p>
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
