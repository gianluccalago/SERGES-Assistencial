import { useState } from 'react';
import { useComercial } from '../../comercial/store';
import {
  type Edital,
  type FaseEdital,
  type GrupoDoc,
  type Modalidade,
  type Periodicidade,
  type DocItem,
  FASE_LABEL,
  GRUPO_LABEL,
  MODALIDADE_LABEL,
  PERIODICIDADE_LABEL,
  avancaVerificacao,
  checklistModelo,
  prazoStatus,
} from '../../comercial/model';
import { todayISO } from '../format';
import { Modal, Field, AnexosEditor, ContatoFields, ContatoAcoes } from './shared';

const GRUPOS: GrupoDoc[] = ['especificos', 'gerais', 'profissionais'];

export function EditalDetail({ edital, onClose }: { edital: Edital; onClose: () => void }) {
  const c = useComercial();
  const [draft, setDraft] = useState<Edital>(edital);
  const [motivo, setMotivo] = useState<{ campo: 'motivoDescarte' | 'motivoPerda'; fase: FaseEdital; texto: string } | null>(null);
  const [verifObs, setVerifObs] = useState('');

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
      titulo={draft.cidade ? `${draft.cidade}/${draft.uf}` : 'Novo edital'}
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

      <AnexosEditor anexos={draft.anexos} onChange={(anexos) => patch({ anexos })} />

      <div>
        <span className="label mb-1 block">Contato da prefeitura</span>
        <ContatoFields contato={draft.contato} onChange={(contato) => patch({ contato })} />
        <div className="mt-2"><ContatoAcoes contato={draft.contato} /></div>
      </div>

      {/* Checklist de documentos */}
      {['reunir', 'conferencia', 'correcao', 'envio', 'enviado', 'ativo', 'perdido'].includes(draft.fase) && (
        <Checklist itens={draft.checklist} onChange={setChecklist} />
      )}

      {/* Comprovação de envio */}
      {['envio', 'enviado', 'ativo', 'perdido'].includes(draft.fase) && (
        <Field label="Comprovação de envio (link do protocolo/print)">
          <input
            className="input"
            placeholder="https://"
            value={draft.comprovacao?.url ?? ''}
            onChange={(e) => patch({ comprovacao: e.target.value ? { id: 'comp', rotulo: 'Comprovação', url: e.target.value } : undefined })}
          />
        </Field>
      )}

      {/* Acompanhamento (enviados) */}
      {draft.fase === 'enviado' && (
        <Acompanhamento
          edital={draft}
          obs={verifObs}
          setObs={setVerifObs}
          onPatch={patch}
          onRegistrar={() => {
            const hoje = todayISO();
            const per = draft.periodicidade ?? 'semanal';
            patch({
              verificacoes: [...draft.verificacoes, { id: `v-${Math.random().toString(36).slice(2, 7)}`, data: hoje, obs: verifObs.trim() || 'Sem resultado ainda' }],
              proximaVerificacao: avancaVerificacao(hoje, per),
              periodicidade: per,
            });
            setVerifObs('');
          }}
        />
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
  return (
    <div className="flex flex-wrap gap-2">
      {f === 'triagem' && <button className="btn-primary" onClick={() => onMove('decisao')}>Enviar para decisão</button>}
      {f === 'decisao' && (
        <>
          <button className="btn-primary" onClick={onIniciarChecklist}>Participar</button>
          <button className="btn-secondary" onClick={() => onPedirMotivo('motivoDescarte', 'descartado')}>Descartar</button>
        </>
      )}
      {f === 'reunir' && <button className="btn-primary" onClick={() => onMove('conferencia')}>Tudo reunido → Conferência</button>}
      {f === 'conferencia' && (
        <>
          <button className="btn-primary" onClick={() => onMove('envio')}>Aprovar → Envio</button>
          <button className="btn-secondary" onClick={() => onMove('correcao')}>Comentar → Correção</button>
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
    </div>
  );
}

function Checklist({ itens, onChange }: { itens: DocItem[]; onChange: (i: DocItem[]) => void }) {
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
              <div key={i.id} className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-serges-blue)]" checked={!!i.pronto} onChange={(e) => onChange(itens.map((x) => (x.id === i.id ? { ...x, pronto: e.target.checked } : x)))} />
                <input className="input flex-1 py-1" value={i.nome} onChange={(e) => onChange(itens.map((x) => (x.id === i.id ? { ...x, nome: e.target.value } : x)))} />
                <input className="input w-[110px] py-1" placeholder="link" value={i.url ?? ''} onChange={(e) => onChange(itens.map((x) => (x.id === i.id ? { ...x, url: e.target.value } : x)))} />
                {i.url && <a className="btn-ghost" href={i.url} target="_blank" rel="noreferrer">abrir</a>}
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

function Acompanhamento({
  edital,
  obs,
  setObs,
  onPatch,
  onRegistrar,
}: {
  edital: Edital;
  obs: string;
  setObs: (v: string) => void;
  onPatch: (p: Partial<Edital>) => void;
  onRegistrar: () => void;
}) {
  return (
    <div className="card p-[var(--spacing-12)]">
      <div className="label mb-2 uppercase">Acompanhamento</div>
      <Field label="URL de acompanhamento (portal)">
        <div className="flex gap-2">
          <input className="input" placeholder="https://" value={edital.urlAcompanhamento ?? ''} onChange={(e) => onPatch({ urlAcompanhamento: e.target.value })} />
          {edital.urlAcompanhamento && <a className="btn-secondary" href={edital.urlAcompanhamento} target="_blank" rel="noreferrer">Abrir</a>}
        </div>
      </Field>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Periodicidade">
          <select className="select" value={edital.periodicidade ?? 'semanal'} onChange={(e) => onPatch({ periodicidade: e.target.value as Periodicidade })}>
            {(Object.keys(PERIODICIDADE_LABEL) as Periodicidade[]).map((p) => <option key={p} value={p}>{PERIODICIDADE_LABEL[p]}</option>)}
          </select>
        </Field>
        <Field label="Resultado previsto">
          <input className="input" type="date" value={edital.dataPrevistaResultado ?? ''} onChange={(e) => onPatch({ dataPrevistaResultado: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Registrar verificação (observação)">
          <textarea className="input" rows={2} placeholder="Ex.: sem resultado ainda; habilitados publicados…" value={obs} onChange={(e) => setObs(e.target.value)} />
        </Field>
        <button className="btn-primary mt-2" onClick={onRegistrar}>Registrar verificação</button>
        <p className="label mt-1">Próxima verificação: {edital.proximaVerificacao ?? '—'}</p>
      </div>
      {edital.verificacoes.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-line)] pt-2">
          <div className="label mb-1">Histórico</div>
          <div className="space-y-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
            {[...edital.verificacoes].reverse().map((v) => (
              <div key={v.id}>{v.data} — {v.obs}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
