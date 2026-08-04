import { useState } from 'react';
import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import { TIPO_LABEL, DEP_LABEL, formatDateLong, todayISO } from '../format';
import { WorkflowPanels } from './WorkflowPanels';
import { Selos } from './Selos';
import { StatusSelector } from './StatusSelector';
import { EditForm } from './EditForm';
import { whatsappLink, mailtoLink } from '../contatoLinks';
import { useToast } from './Toast';
import { Subtarefas } from './Subtarefas';

export function ObligationDetail({
  ro,
  onClose,
  onEditarRecorrencia,
}: {
  ro: ResolvedObligation;
  onClose: () => void;
  /** Abre a tarefa-mãe para mudar a repetição (todas as datas). */
  onEditarRecorrencia?: (manualId: string) => void;
}) {
  const store = useStore();
  const toast = useToast();
  const { item, prazo } = ro;
  const [novaData, setNovaData] = useState(prazo ?? todayISO());
  const [notas, setNotas] = useState(item.notas ?? '');
  const [editando, setEditando] = useState(false);
  const [valorFaltante, setValorFaltante] = useState('');

  const podeResolverMes = item.tipo === 'lotePagamento' || item.id.startsWith('faturamentoIniciar:');
  const ehFaturamento = item.id.startsWith('faturamentoIniciar:');

  const projeto = item.projetoId ? store.state.projects.find((p) => p.id === item.projetoId) : undefined;
  const contatos = store.contatosDoProjeto(item.projetoId).filter((c) => c.categoria === 'contratante');

  function patchNotas() {
    if (item.isManual) {
      const m = store.state.manualObligations.find((x) => x.id === item.id);
      if (m) store.updateManual({ ...m, notas });
    } else {
      store.patchOverride(item.id, { notas });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="drawer h-full w-full max-w-[480px] overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-24)] shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">{TIPO_LABEL[item.tipo]}{item.isManual ? ' · manual' : ''}</div>
            <h2 className="mt-1 text-[length:var(--text-heading)]">{item.titulo}</h2>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Status: troca livre entre os quatro estados, ida e volta. */}
        <div className="mt-[var(--spacing-16)] flex flex-wrap items-center gap-2">
          <StatusSelector ro={ro} />
          <Selos ro={ro} />
          {item.movida && (
            <span className="chip border-[var(--color-serges-blue)] text-[var(--color-serges-blue)]">Movida</span>
          )}
        </div>

        {/* Ocorrência de tarefa repetida: deixa explícito o alcance da edição. */}
        {item.ocorrenciaDe && (
          <div className="mt-[var(--spacing-16)] rounded-[var(--radius-md)] border border-[rgba(77,125,255,0.35)] bg-[var(--color-serges-blue-tint-soft)] p-3">
            <div className="flex items-start gap-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-[var(--color-serges-blue-strong)]">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <div className="min-w-0">
                <div className="text-[length:var(--text-label)] font-medium text-[var(--color-ink)]">Tarefa repetida</div>
                <p className="label mt-0.5">{item.regraOrigem}</p>
                <p className="label mt-1">O que você mudar aqui vale só para esta data.</p>
              </div>
            </div>
            {onEditarRecorrencia && (
              <button
                className="btn-secondary mt-2 w-full"
                onClick={() => onEditarRecorrencia(item.ocorrenciaDe as string)}
              >
                Editar a repetição (todas as datas)
              </button>
            )}
          </div>
        )}

        <dl className="mt-[var(--spacing-20)] space-y-2 text-[length:var(--text-label)]">
          {prazo && <Row k="Prazo">{formatDateLong(prazo)}</Row>}
          {!prazo && item.dependenciaAguardada && (
            <Row k="Aguardando">{DEP_LABEL[item.dependenciaAguardada]}</Row>
          )}
          {projeto && <Row k="Projeto">{projeto.nome}</Row>}
          {item.responsavel && <Row k="Responsável">{item.responsavel}</Row>}
          <Row k="Regra de origem">{item.regraOrigem}</Row>
        </dl>

        {item.tipo === 'fixa' && !item.isManual && (
          <p className="label rounded-[var(--radius-sm)] bg-[var(--color-serges-blue-tint)] p-2 text-[var(--color-serges-blue)]">
            Para mudar o dia/regra desta série (e recalcular todas as datas), ou criar/excluir séries, use a aba <strong>Séries</strong> no menu.
          </p>
        )}

        {/* Recuperação carregada do mês anterior (faturamento parcial, §4.5) */}
        {item.recuperacao && (
          <div className="card mt-[var(--spacing-16)] border-l-[3px] border-l-[var(--color-serges-blue)] p-[var(--spacing-16)]">
            <div className="label mb-1 uppercase">Recuperação do mês anterior</div>
            <p className="text-[length:var(--text-label)]">
              {item.recuperacao.texto} · R$ {item.recuperacao.valor.toLocaleString('pt-BR')}
            </p>
          </div>
        )}

        {/* Resolução de mês (§4.5) */}
        {podeResolverMes && (
          <div className="card mt-[var(--spacing-16)] p-[var(--spacing-16)]">
            <div className="label mb-2 uppercase">Resolução do mês</div>
            {item.resolucaoMes === 'semAtuacao' ? (
              <div className="flex items-center justify-between gap-2">
                <span className="chip">Sem atuação neste mês</span>
                <button className="btn-secondary" onClick={() => store.setResolucaoMes(item, undefined)}>
                  Desfazer
                </button>
              </div>
            ) : item.resolucaoMes === 'faturadoParcialmente' ? (
              <span className="chip">Faturado parcialmente</span>
            ) : (
              <div className="space-y-2">
                <button className="btn-secondary w-full" onClick={() => store.setResolucaoMes(item, 'semAtuacao')}>
                  Não atuamos neste projeto neste mês
                </button>
                {ehFaturamento && (
                  <div className="flex gap-2">
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder="Valor faltante"
                      value={valorFaltante}
                      onChange={(e) => setValorFaltante(e.target.value)}
                    />
                    <button
                      className="btn-secondary"
                      disabled={!valorFaltante}
                      onClick={() => {
                        store.faturadoParcialmente(item, Number(valorFaltante.replace(',', '.')));
                        onClose();
                      }}
                    >
                      Faturado incompletamente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Contatos do contratante + escalonamento (§11.8, fonte: aba Contatos) */}
        {contatos.length > 0 && (
          <div className="card mt-[var(--spacing-16)] p-[var(--spacing-16)]">
            <div className="label mb-2 uppercase">Contato do contratante</div>
            <div className="space-y-2">
              {contatos.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[length:var(--text-label)] font-medium">
                      {c.nome}
                      {c.escalonamento && (
                        <span className="ml-2 text-[length:var(--text-caption)] text-[var(--color-serges-blue)]">escalonamento</span>
                      )}
                    </div>
                    {c.papel && <div className="label">{c.papel}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {c.telefone && (
                      <a className="btn-secondary" href={whatsappLink(c.telefone)} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    )}
                    {c.email && (
                      <a className="btn-secondary" href={mailtoLink(c.email)}>
                        E-mail
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Painéis de workflow (§11) */}
        <WorkflowPanels ro={ro} />

        {/* Mover de data */}
        <div className="card mt-[var(--spacing-20)] p-[var(--spacing-16)]">
          <div className="label mb-2">Mover para outra data</div>
          <div className="flex gap-2">
            <input className="input" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            <button className="btn-secondary" onClick={() => store.moveItem(item, novaData)}>
              Mover
            </button>
          </div>
        </div>

        {/* Etapas da obrigação (checklist de acompanhamento) */}
        <div className="mt-[var(--spacing-20)]">
          <Subtarefas valor={item.subtarefas} onChange={(sub) => store.setSubtarefas(item, sub)} />
        </div>

        {/* Notas */}
        <div className="mt-[var(--spacing-20)]">
          <div className="label mb-1">Notas</div>
          <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} onBlur={patchNotas} />
        </div>

        {/* Editar / Excluir */}
        <div className="mt-[var(--spacing-24)] flex items-center justify-between border-t border-[var(--color-line)] pt-[var(--spacing-16)]">
          <button className="btn-secondary" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button
            className="btn-ghost text-[var(--color-overdue)]"
            onClick={() => {
              if (item.isManual) {
                const original = store.state.manualObligations.find((m) => m.id === item.id);
                store.deleteItem(item);
                toast.show('Excluída.', original ? () => store.addManual(original) : undefined);
              } else {
                store.deleteItem(item);
                toast.show(item.ocorrenciaDe ? 'Esta data foi removida.' : 'Ocultada.', () => store.undismiss(item.id));
              }
              onClose();
            }}
          >
            {item.isManual ? 'Excluir' : item.ocorrenciaDe ? 'Remover esta data' : 'Ocultar'}
          </button>
        </div>
      </div>

      {editando && <EditForm ro={ro} onClose={() => setEditando(false)} />}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-line)] pb-2">
      <dt className="label shrink-0">{k}</dt>
      <dd className="text-right text-[var(--color-ink)]">{children}</dd>
    </div>
  );
}
