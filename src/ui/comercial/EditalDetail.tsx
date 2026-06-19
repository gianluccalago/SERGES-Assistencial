import { useState } from 'react';
import { useComercial } from '../../comercial/store';
import {
  type Edital,
  type FaseEdital,
  type GrupoDoc,
  type Modalidade,
  type DocItem,
  FASE_LABEL,
  GRUPO_LABEL,
  MODALIDADE_LABEL,
  checklistModelo,
  prazoStatus,
} from '../../comercial/model';
import { todayISO } from '../format';
import { Modal, Field, AnexosEditor, AnexoUploadButton, ContatoFields, ContatoAcoes, abrirAnexo } from './shared';
import { useGestorGate } from '../../auth/AuthProvider';

const GRUPOS: GrupoDoc[] = ['especificos', 'gerais', 'profissionais'];

// Fase anterior, para o botão "Voltar".
const FASE_ANTERIOR: Partial<Record<FaseEdital, FaseEdital>> = {
  decisao: 'triagem',
  reunir: 'decisao',
  conferencia: 'reunir',
  correcao: 'conferencia',
  envio: 'conferencia',
  enviado: 'envio',
  ativo: 'enviado',
  perdido: 'enviado',
  descartado: 'decisao',
};

export function EditalDetail({ edital, onClose }: { edital: Edital; onClose: () => void }) {
  const c = useComercial();
  const [draft, setDraft] = useState<Edital>(edital);
  const [motivo, setMotivo] = useState<{ campo: 'motivoDescarte' | 'motivoPerda'; fase: FaseEdital; texto: string } | null>(null);

  // Auto-salva a cada alteração (módulo simples, dados pequenos).
  function patch(p: Partial<Edital>) {
    const next = { ...draft, ...p };
    setDraft(next);
    c.upsertEdital(next);
  }

  const subPrazo = prazoStatus(draft.submissaoFim, todayISO());

  function setChecklist(items: DocItem[]) {
    patch({ checklist: items });
  }

  return (
    <Modal
      titulo={draft.titulo || (draft.cidade ? `${draft.cidade}/${draft.uf}` : 'Nova licitação')}
      onClose={onClose}
      footer={
        <button
          className="btn-ghost ml-auto text-[var(--color-overdue)]"
          onClick={() => {
            c.removeEdital(draft.id);
            onClose();
          }}
        >
          Excluir edital
        </button>
      }
    >
      {/* Fase + prazo de submissão */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-[var(--color-serges-blue-tint)] border-[var(--color-serges-blue)] text-[var(--color-serges-blue)]">{FASE_LABEL[draft.fase]}</span>
        {subPrazo === 'vencido' && <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Submissão vencida</span>}
        {subPrazo === 'proximo' && <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Submissão próxima</span>}
      </div>

      {/* Ações de fase */}
      <FaseAcoes
        edital={draft}
        onMove={(fase) => patch({ fase })}
        onPedirMotivo={(campo, fase) => setMotivo({ campo, fase, texto: '' })}
        onGanhar={() => {
          c.ganharEdital(draft);
          onClose();
        }}
        onIniciarChecklist={() => {
          if (draft.checklist.length === 0) patch({ checklist: checklistModelo(), fase: 'reunir' });
          else patch({ fase: 'reunir' });
        }}
      />

      {motivo && (
        <div className="card p-[var(--spacing-12)]">
          <div className="label mb-1">Motivo (opcional para descarte; obrigatório para perda)</div>
          <textarea className="input" rows={2} value={motivo.texto} onChange={(e) => setMotivo({ ...motivo, texto: e.target.value })} />
          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary"
              disabled={motivo.fase === 'perdido' && !motivo.texto.trim()}
              onClick={() => {
                patch({ fase: motivo.fase, [motivo.campo]: motivo.texto.trim() } as Partial<Edital>);
                setMotivo(null);
              }}
            >
              Confirmar
            </button>
            <button className="btn-secondary" onClick={() => setMotivo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Campos base */}
      <Field label="Título (hospital/UPA/UBS)"><input className="input" placeholder="Ex.: Hospital Municipal de…" value={draft.titulo ?? ''} onChange={(e) => patch({ titulo: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade"><input className="input" value={draft.cidade} onChange={(e) => patch({ cidade: e.target.value })} /></Field>
        <Field label="UF"><input className="input" maxLength={2} value={draft.uf} onChange={(e) => patch({ uf: e.target.value.toUpperCase() })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de serviço"><input className="input" value={draft.tipoServico ?? ''} onChange={(e) => patch({ tipoServico: e.target.value })} /></Field>
        <Field label="Valor pago no edital"><input className="input" inputMode="decimal" value={draft.valor ?? ''} onChange={(e) => patch({ valor: e.target.value ? Number(e.target.value.replace(',', '.')) : undefined })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Submissão — início"><input className="input" type="date" value={draft.submissaoInicio ?? ''} onChange={(e) => patch({ submissaoInicio: e.target.value })} /></Field>
        <Field label="Submissão — fim"><input className="input" type="date" value={draft.submissaoFim ?? ''} onChange={(e) => patch({ submissaoFim: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Modalidade">
          <select className="select" value={draft.modalidade ?? ''} onChange={(e) => patch({ modalidade: (e.target.value || undefined) as Modalidade | undefined })}>
            <option value="">—</option>
            {(Object.keys(MODALIDADE_LABEL) as Modalidade[]).map((m) => <option key={m} value={m}>{MODALIDADE_LABEL[m]}</option>)}
          </select>
        </Field>
        <Field label="Link do edital"><input className="input" placeholder="https://" value={draft.linkEdital ?? ''} onChange={(e) => patch({ linkEdital: e.target.value })} /></Field>
      </div>

      <AnexosEditor anexos={draft.anexos} onChange={(anexos) => patch({ anexos })} prefixo={`editais/${draft.id}/iniciais`} />

      <div>
        <span className="label mb-1 block">Contato da prefeitura</span>
        <ContatoFields contato={draft.contato} onChange={(contato) => patch({ contato })} />
        <div className="mt-2"><ContatoAcoes contato={draft.contato} /></div>
      </div>

      {/* Checklist de documentos */}
      {['reunir', 'conferencia', 'correcao', 'envio', 'enviado', 'ativo', 'perdido'].includes(draft.fase) && (
        <Checklist itens={draft.checklist} onChange={setChecklist} editalId={draft.id} />
      )}

      {/* Comprovação de envio (arquivo real ou link) */}
      {['envio', 'enviado', 'ativo', 'perdido'].includes(draft.fase) && (
        <div>
          <span className="label mb-1 block">Comprovação de envio (protocolo/print)</span>
          {draft.comprovacao && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-1.5">
              <span className="min-w-0 truncate text-[length:var(--text-label)]">{draft.comprovacao.path ? '📎 ' : '🔗 '}{draft.comprovacao.rotulo}</span>
              <span className="flex shrink-0 gap-1">
                <button className="btn-secondary" onClick={() => draft.comprovacao && abrirAnexo(draft.comprovacao)}>Abrir</button>
                <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => patch({ comprovacao: undefined })}>remover</button>
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <AnexoUploadButton prefixo={`editais/${draft.id}/comprovacao`} onUploaded={(r) => patch({ comprovacao: { id: 'comp', rotulo: r.nome, path: r.path, nome: r.nome } })} />
            <span className="label">ou link:</span>
            <input
              className="input flex-1"
              placeholder="https:// (protocolo/print)"
              value={draft.comprovacao?.url ?? ''}
              onChange={(e) => patch({ comprovacao: e.target.value ? { id: 'comp', rotulo: 'Comprovação', url: e.target.value } : undefined })}
            />
          </div>
        </div>
      )}

      {draft.fase === 'enviado' && (
        <p className="label rounded-[var(--radius-sm)] bg-[var(--color-serges-blue-tint)] p-2 text-[var(--color-serges-blue)]">
          O acompanhamento desta licitação é feito na aba “Acompanhamento de Licitações”.
        </p>
      )}

      {(draft.motivoDescarte || draft.motivoPerda) && (
        <p className="label">Motivo: {draft.motivoDescarte || draft.motivoPerda}</p>
      )}
    </Modal>
  );
}

function FaseAcoes({
  edital,
  onMove,
  onPedirMotivo,
  onGanhar,
  onIniciarChecklist,
}: {
  edital: Edital;
  onMove: (f: FaseEdital) => void;
  onPedirMotivo: (campo: 'motivoDescarte' | 'motivoPerda', fase: FaseEdital) => void;
  onGanhar: () => void;
  onIniciarChecklist: () => void;
}) {
  const f = edital.fase;
  const { isGestor, gestorProps } = useGestorGate();
  return (
    <div className="flex flex-wrap gap-2">
      {f === 'triagem' && <button className="btn-primary" onClick={() => onMove('decisao')}>Enviar para decisão</button>}
      {f === 'decisao' && (
        <>
          <button className="btn-primary" {...gestorProps} onClick={isGestor ? onIniciarChecklist : undefined}>Participar</button>
          <button className="btn-secondary" {...gestorProps} onClick={isGestor ? () => onPedirMotivo('motivoDescarte', 'descartado') : undefined}>Descartar</button>
          {!isGestor && <span className="label self-center">Decisão é ação exclusiva do gestor.</span>}
        </>
      )}
      {f === 'reunir' && <button className="btn-primary" onClick={() => onMove('conferencia')}>Tudo reunido → Conferência</button>}
      {f === 'conferencia' && (
        <>
          <button className="btn-primary" {...gestorProps} onClick={isGestor ? () => onMove('envio') : undefined}>Aprovar → Envio</button>
          <button className="btn-secondary" {...gestorProps} onClick={isGestor ? () => onMove('correcao') : undefined}>Comentar → Correção</button>
          {!isGestor && <span className="label self-center">Conferência é ação exclusiva do gestor.</span>}
        </>
      )}
      {f === 'correcao' && <button className="btn-primary" onClick={() => onMove('conferencia')}>Devolver → Conferência</button>}
      {f === 'envio' && <button className="btn-primary" onClick={() => onMove('enviado')}>Marcar enviado</button>}
      {f === 'enviado' && (
        <>
          <button className="btn-primary" onClick={onGanhar}>Ganhamos → Ativos</button>
          <button className="btn-secondary" onClick={() => onPedirMotivo('motivoPerda', 'perdido')}>Perdido</button>
        </>
      )}
      {(f === 'descartado' || f === 'perdido') && <button className="btn-secondary" onClick={() => onMove('triagem')}>Reabrir → Triagem</button>}
      {FASE_ANTERIOR[f] && (
        <button className="btn-ghost ml-auto" onClick={() => onMove(FASE_ANTERIOR[f]!)} title={`Voltar para ${FASE_LABEL[FASE_ANTERIOR[f]!]}`}>
          ← Voltar
        </button>
      )}
    </div>
  );
}

function Checklist({ itens, onChange, editalId }: { itens: DocItem[]; onChange: (i: DocItem[]) => void; editalId: string }) {
  const [novo, setNovo] = useState<Record<GrupoDoc, string>>({ especificos: '', gerais: '', profissionais: '' });
  const prontos = itens.filter((i) => i.pronto).length;
  return (
    <div className="card p-[var(--spacing-12)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="label uppercase">Documentos</span>
        <span className="chip">{prontos}/{itens.length} prontos</span>
      </div>
      {GRUPOS.map((g) => (
        <div key={g} className="mb-2">
          <div className="label mb-1">{GRUPO_LABEL[g]}</div>
          <div className="space-y-1">
            {itens.filter((i) => i.grupo === g).map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-serges-blue)]" checked={!!i.pronto} onChange={(e) => onChange(itens.map((x) => (x.id === i.id ? { ...x, pronto: e.target.checked } : x)))} />
                <input className="input min-w-[120px] flex-1 py-1" value={i.nome} onChange={(e) => onChange(itens.map((x) => (x.id === i.id ? { ...x, nome: e.target.value } : x)))} />
                {i.path ? (
                  <>
                    <button className="btn-ghost" onClick={() => abrirAnexo({ id: i.id, rotulo: i.nomeArquivo ?? 'arquivo', path: i.path })}>📎 abrir</button>
                    <button className="btn-ghost" onClick={() => onChange(itens.map((x) => (x.id === i.id ? { ...x, path: undefined, nomeArquivo: undefined } : x)))}>tirar</button>
                  </>
                ) : (
                  <AnexoUploadButton
                    prefixo={`editais/${editalId}/${g}`}
                    label="anexar"
                    onUploaded={(r) => onChange(itens.map((x) => (x.id === i.id ? { ...x, path: r.path, nomeArquivo: r.nome, pronto: true } : x)))}
                  />
                )}
                <input className="input w-[110px] py-1" placeholder="ou link" value={i.url ?? ''} onChange={(e) => onChange(itens.map((x) => (x.id === i.id ? { ...x, url: e.target.value } : x)))} />
                {i.url && <a className="btn-ghost" href={i.url} target="_blank" rel="noreferrer">↗</a>}
                <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => onChange(itens.filter((x) => x.id !== i.id))}>×</button>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            <input className="input py-1" placeholder={`Adicionar item em ${GRUPO_LABEL[g].toLowerCase()}`} value={novo[g]} onChange={(e) => setNovo((n) => ({ ...n, [g]: e.target.value }))} />
            <button
              className="btn-secondary"
              disabled={!novo[g].trim()}
              onClick={() => {
                onChange([...itens, { id: `doc-${Math.random().toString(36).slice(2, 7)}`, grupo: g, nome: novo[g].trim() }]);
                setNovo((n) => ({ ...n, [g]: '' }));
              }}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
