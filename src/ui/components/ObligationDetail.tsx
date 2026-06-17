import { useState } from 'react';
import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import { ESTADO_LABEL, TIPO_LABEL, DEP_LABEL, estadoChipClass, formatDateLong, todayISO } from '../format';
import { registrarRetorno } from '../../domain/stateMachine';

export function ObligationDetail({
  item,
  onClose,
}: {
  item: ResolvedObligation;
  onClose: () => void;
}) {
  const store = useStore();
  const { obligation, userState, estado, prazo, aprovacaoEstourada, podeConcluir } = item;
  const [prazoManual, setPrazoManual] = useState(todayISO());

  const projeto = obligation.projetoId
    ? store.state.projects.find((p) => p.id === obligation.projetoId)
    : undefined;

  function patch(p: Parameters<typeof store.updateObligationState>[1]) {
    store.updateObligationState(obligation.id, p);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="surface hairline h-full w-full max-w-[460px] overflow-y-auto p-[var(--spacing-24)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">{TIPO_LABEL[obligation.tipo]}</div>
            <h2 className="text-[length:var(--text-subheading)] leading-[var(--leading-subheading)] mt-1">
              {obligation.titulo}
            </h2>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mt-[var(--spacing-20)] flex flex-wrap gap-2">
          <span className={estadoChipClass(estado)}>{ESTADO_LABEL[estado]}</span>
          {obligation.critico && <span className="chip">Crítico</span>}
          {aprovacaoEstourada && (
            <span className="chip border-[var(--color-ember)] text-[var(--color-ember)]">
              Aprovação &gt; 24h
            </span>
          )}
        </div>

        <dl className="mt-[var(--spacing-20)] space-y-2 text-[length:var(--text-caption)]">
          {prazo && (
            <Row k="Prazo">{formatDateLong(prazo)}</Row>
          )}
          {!prazo && obligation.dependenciaAguardada && (
            <Row k="Aguardando">{DEP_LABEL[obligation.dependenciaAguardada]}</Row>
          )}
          {projeto && <Row k="Projeto">{projeto.nome}</Row>}
          {obligation.responsavel && <Row k="Escalista">{obligation.responsavel}</Row>}
          <Row k="Regra de origem">{obligation.regraOrigem}</Row>
          <Row k="ID">{obligation.id}</Row>
        </dl>

        {obligation.tipo === 'cardPagamento' && (
          <label className="mt-[var(--spacing-20)] flex items-center gap-3 text-[length:var(--text-caption)]">
            <input
              type="checkbox"
              checked={userState?.anexoPlanilha ?? false}
              onChange={(e) => patch({ anexoPlanilha: e.target.checked })}
            />
            Planilha de origem do valor anexada (pré-requisito para concluir)
          </label>
        )}

        {/* Registrar retorno de terceiro */}
        {obligation.tipo === 'faturamentoCard' && estado === 'aguardandoRetorno' && (
          <div className="surface hairline mt-[var(--spacing-20)] p-[var(--spacing-16)]">
            <div className="label mb-2">Registrar recebimento do retorno</div>
            <input
              className="input"
              type="date"
              value={prazoManual}
              onChange={(e) => setPrazoManual(e.target.value)}
            />
            <button
              className="btn-primary mt-3"
              onClick={() => {
                store.updateObligationState(
                  obligation.id,
                  registrarRetorno(userState, todayISO(), prazoManual),
                );
              }}
            >
              Registrar e gerar tarefa
            </button>
          </div>
        )}

        {/* Ações */}
        <div className="mt-[var(--spacing-24)] flex flex-wrap gap-2">
          <button className="btn-secondary" data-active onClick={() => patch({ estado: 'emCobranca' })}>
            Mover para cobrança
          </button>
          <button
            className="btn-secondary"
            data-active
            onClick={() => patch({ estado: 'escalada' })}
          >
            Escalar
          </button>
          {estado !== 'concluida' ? (
            <button
              className="btn-primary"
              disabled={!podeConcluir}
              title={!podeConcluir ? 'Anexe a planilha de origem antes de concluir' : undefined}
              onClick={() => patch({ estado: 'concluida' })}
            >
              Marcar como concluída
            </button>
          ) : (
            <button className="btn-secondary" data-active onClick={() => patch({ estado: 'pendente' })}>
              Reabrir
            </button>
          )}
        </div>

        <div className="mt-[var(--spacing-20)]">
          <button
            className="btn-secondary"
            onClick={() =>
              patch({ enviadaAprovacaoEm: new Date().toISOString() })
            }
          >
            Enviar para aprovação (24h)
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[color-mix(in_srgb,var(--color-ash)_12%,transparent)] pb-2">
      <dt className="label shrink-0">{k}</dt>
      <dd className="text-right text-[var(--color-bone)]">{children}</dd>
    </div>
  );
}
