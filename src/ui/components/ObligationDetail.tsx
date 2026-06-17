import { useState } from 'react';
import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import type { ObligationEstado } from '../../domain/types';
import {
  ESTADO_LABEL,
  TIPO_LABEL,
  DEP_LABEL,
  estadoChipClass,
  formatDateLong,
  todayISO,
} from '../format';
import { registrarRetorno } from '../../domain/stateMachine';

export function ObligationDetail({
  ro,
  onClose,
  onEditManual,
}: {
  ro: ResolvedObligation;
  onClose: () => void;
  onEditManual: (id: string) => void;
}) {
  const store = useStore();
  const { item, estado, prazo, aprovacaoEstourada, podeConcluir } = ro;
  const [prazoRetorno, setPrazoRetorno] = useState(todayISO());
  const [novaData, setNovaData] = useState(prazo ?? todayISO());
  const [notas, setNotas] = useState(item.notas ?? '');

  const projeto = item.projetoId
    ? store.state.projects.find((p) => p.id === item.projetoId)
    : undefined;

  // Atualiza um campo de estado, gravando override (gerada) ou alterando o registro (manual).
  function setField(patch: { estado?: ObligationEstado; anexoPresente?: boolean; notas?: string; enviadaAprovacaoEm?: string }) {
    if (item.isManual) {
      const m = store.state.manualObligations.find((x) => x.id === item.id);
      if (m) store.updateManual({ ...m, ...patch });
    } else {
      store.patchOverride(item.id, patch);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-[480px] overflow-y-auto bg-[var(--color-surface)] p-[var(--spacing-24)] shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">{TIPO_LABEL[item.tipo]}{item.isManual ? ' · manual' : ''}</div>
            <h2 className="mt-1 text-[length:var(--text-heading)]">{item.titulo}</h2>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mt-[var(--spacing-16)] flex flex-wrap gap-2">
          <span className={estadoChipClass(estado)}>{ESTADO_LABEL[estado]}</span>
          {item.critico && <span className="chip">Crítico</span>}
          {item.movida && <span className="chip text-[var(--color-serges-blue)] border-[var(--color-serges-blue)]">Movida</span>}
          {aprovacaoEstourada && (
            <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Aprovação &gt; 24h</span>
          )}
        </div>

        <dl className="mt-[var(--spacing-20)] space-y-2 text-[length:var(--text-label)]">
          {prazo && <Row k="Prazo">{formatDateLong(prazo)}</Row>}
          {!prazo && item.dependenciaAguardada && (
            <Row k="Aguardando">{DEP_LABEL[item.dependenciaAguardada]}</Row>
          )}
          {projeto && <Row k="Projeto">{projeto.nome}</Row>}
          {item.responsavel && <Row k="Escalista">{item.responsavel}</Row>}
          <Row k="Regra de origem">{item.regraOrigem}</Row>
        </dl>

        {/* Anexo da planilha (pré-requisito de cards de pagamento) */}
        {item.tipo === 'cardPagamento' && (
          <label className="mt-[var(--spacing-20)] flex items-center gap-3 text-[length:var(--text-label)]">
            <input
              type="checkbox"
              checked={item.anexoPresente ?? false}
              onChange={(e) => setField({ anexoPresente: e.target.checked })}
            />
            Planilha de origem do valor anexada (necessária para concluir)
          </label>
        )}

        {/* Registrar retorno de terceiro (gerada, faturamentoCard) */}
        {item.tipo === 'faturamentoCard' && estado === 'aguardandoRetorno' && !item.isManual && (
          <div className="card mt-[var(--spacing-20)] p-[var(--spacing-16)]">
            <div className="label mb-2">Registrar recebimento do retorno</div>
            <input className="input" type="date" value={prazoRetorno} onChange={(e) => setPrazoRetorno(e.target.value)} />
            <button
              className="btn-primary mt-3 w-full"
              onClick={() => {
                store.patchOverride(item.id, registrarRetorno(store.getOverride(item.id), todayISO(), prazoRetorno));
                onClose();
              }}
            >
              Registrar e gerar tarefa
            </button>
          </div>
        )}

        {/* Mover de data */}
        <div className="card mt-[var(--spacing-20)] p-[var(--spacing-16)]">
          <div className="label mb-2">Mover para outra data{item.isManual ? '' : ' (grava override)'}</div>
          <div className="flex gap-2">
            <input className="input" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            <button className="btn-secondary" onClick={() => store.moveItem(item, novaData)}>
              Mover
            </button>
          </div>
        </div>

        {/* Notas */}
        <div className="mt-[var(--spacing-20)]">
          <div className="label mb-1">Notas</div>
          <textarea
            className="input"
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() => setField({ notas })}
          />
        </div>

        {/* Ações de estado */}
        <div className="mt-[var(--spacing-24)] flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setField({ estado: 'emCobranca' })}>
            Cobrança
          </button>
          <button className="btn-secondary" onClick={() => setField({ estado: 'escalada' })}>
            Escalar
          </button>
          <button className="btn-secondary" onClick={() => setField({ enviadaAprovacaoEm: new Date().toISOString() })}>
            Enviar p/ aprovação
          </button>
          {estado !== 'concluida' ? (
            <button
              className="btn-primary"
              disabled={!podeConcluir}
              title={!podeConcluir ? 'Anexe a planilha de origem antes de concluir' : undefined}
              onClick={() => setField({ estado: 'concluida' })}
            >
              Concluir
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => setField({ estado: 'pendente' })}>
              Reabrir
            </button>
          )}
        </div>

        {/* Editar / Excluir */}
        <div className="mt-[var(--spacing-24)] flex items-center justify-between border-t border-[var(--color-line)] pt-[var(--spacing-16)]">
          {item.isManual ? (
            <button className="btn-secondary" onClick={() => onEditManual(item.id)}>
              Editar obrigação
            </button>
          ) : (
            <span className="label">Obrigação gerada por regra</span>
          )}
          <button
            className="btn-ghost text-[var(--color-overdue)]"
            onClick={() => {
              store.deleteItem(item);
              onClose();
            }}
          >
            {item.isManual ? 'Excluir registro' : 'Excluir (ocultar)'}
          </button>
        </div>
      </div>
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
