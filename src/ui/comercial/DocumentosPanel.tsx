import { useMemo } from 'react';
import { useComercial } from '../../comercial/store';
import { type Documento, documentoNovo, diasAte } from '../../comercial/model';
import { todayISO } from '../format';
import { AnexoUploadButton, abrirAnexo } from './shared';

// Documentos de uso recorrente nas licitações (CNDs, contrato social, etc.).
// Cada documento tem título, o arquivo (ou link), um link para emitir nova via
// e a data de validade, que avisa quando estiver perto de vencer.
const ALERTA_DIAS = 30;

export function DocumentosPanel() {
  const c = useComercial();
  const hoje = todayISO();
  const docs = useMemo(
    () => [...c.state.documentos].sort((a, b) => (a.validade ?? '9999').localeCompare(b.validade ?? '9999')),
    [c.state.documentos],
  );

  const vencendo = docs.filter((d) => d.validade && diasAte(d.validade, hoje) <= ALERTA_DIAS).length;

  return (
    <div className="space-y-[var(--spacing-16)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
          Documentos de uso recorrente (CNDs, contrato social, certidões…). Anexe o arquivo, o link para emitir nova via e a validade.
        </p>
        {vencendo > 0 && <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">{vencendo} vencendo/vencido(s)</span>}
        <button className="btn-primary ml-auto" onClick={() => c.upsertDocumento(documentoNovo())}>+ Novo documento</button>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-ink-soft)]">
          Nenhum documento cadastrado. Use “+ Novo documento”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <CardDocumento key={d.id} d={d} hoje={hoje} onPatch={(p) => c.upsertDocumento({ ...d, ...p })} onRemover={() => c.removeDocumento(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardDocumento({
  d,
  hoje,
  onPatch,
  onRemover,
}: {
  d: Documento;
  hoje: string;
  onPatch: (p: Partial<Documento>) => void;
  onRemover: () => void;
}) {
  const dias = d.validade ? diasAte(d.validade, hoje) : undefined;
  const vencido = dias != null && dias < 0;
  const alerta = dias != null && dias <= ALERTA_DIAS;
  const cor = alerta ? 'var(--color-overdue)' : 'var(--color-done)';

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-16)] shadow-[var(--shadow-rest)]" style={{ borderLeft: `3px solid ${d.validade ? cor : 'var(--color-line)'}` }}>
      <input
        className="input font-medium"
        placeholder="Nome do documento (ex.: CND Federal)"
        value={d.titulo}
        onChange={(e) => onPatch({ titulo: e.target.value })}
      />

      {/* Arquivo */}
      <div className="flex flex-wrap items-center gap-2">
        {d.anexo ? (
          <>
            <button className="btn-secondary" onClick={() => d.anexo && abrirAnexo(d.anexo)}>Abrir</button>
            {d.anexo.path && <button className="btn-ghost" onClick={() => d.anexo && abrirAnexo(d.anexo, true)}>baixar</button>}
            <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => onPatch({ anexo: undefined })}>tirar</button>
          </>
        ) : (
          <>
            <AnexoUploadButton prefixo={`documentos/${d.id}`} label="Anexar documento" onUploaded={(r) => onPatch({ anexo: { id: 'doc', rotulo: r.nome, path: r.path, nome: r.nome } })} />
            <span className="label">ou cole o link abaixo</span>
          </>
        )}
      </div>
      {!d.anexo && (
        <input className="input" placeholder="Link do documento (SharePoint/portal)" onBlur={(e) => e.target.value.trim() && onPatch({ anexo: { id: 'doc', rotulo: d.titulo || 'Documento', url: e.target.value.trim() } })} />
      )}

      {/* Link para emitir nova via */}
      <label className="block">
        <span className="label mb-1 block">Link para emitir nova via</span>
        <div className="flex gap-2">
          <input className="input" placeholder="https://" value={d.linkOrigem ?? ''} onChange={(e) => onPatch({ linkOrigem: e.target.value })} />
          {d.linkOrigem && <a className="btn-secondary" href={d.linkOrigem} target="_blank" rel="noreferrer">Abrir ↗</a>}
        </div>
      </label>

      {/* Validade */}
      <label className="block">
        <span className="label mb-1 block">Validade</span>
        <input className="input" type="date" value={d.validade ?? ''} onChange={(e) => onPatch({ validade: e.target.value })} />
      </label>
      {dias != null && (
        <span className="chip w-fit" style={{ borderColor: cor, color: cor }}>
          {vencido ? `Vencido há ${-dias}d` : dias === 0 ? 'Vence hoje' : `Vence em ${dias}d`}
        </span>
      )}

      <button className="btn-ghost mt-1 self-start text-[var(--color-overdue)]" onClick={onRemover}>Excluir documento</button>
    </div>
  );
}
