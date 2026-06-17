import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import { TIPO_LABEL, itemAccentClass, formatDateShort } from '../format';
import { progressoTexto } from '../../domain/stateMachine';
import { Selos } from './Selos';
import { QuickActions } from './QuickActions';

interface Props {
  ro: ResolvedObligation;
  onSelect: (ro: ResolvedObligation) => void;
  variant?: 'week' | 'list';
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export function ObligationCard({ ro, onSelect, draggable, onDragStart }: Props) {
  const store = useStore();
  const { item, estado, prazo } = ro;
  const projeto = item.projetoId
    ? store.state.projects.find((p) => p.id === item.projetoId)?.nome
    : undefined;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`card p-[var(--spacing-12)] transition ${itemAccentClass({
        atrasada: ro.atrasada,
        concluido: estado === 'concluida',
        critico: ro.critico,
      })} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onSelect(ro)} className="min-w-0 flex-1 text-left">
          <div
            className={`text-[length:var(--text-label)] font-medium ${
              estado === 'concluida' ? 'text-[var(--color-ink-soft)] line-through' : 'text-[var(--color-ink)]'
            }`}
          >
            {item.titulo}
          </div>
          <div className="label mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{TIPO_LABEL[item.tipo]}</span>
            {projeto && <span>· {projeto}</span>}
            {item.responsavel && <span>· {item.responsavel}</span>}
            {prazo && <span>· {formatDateShort(prazo)}</span>}
            {item.isManual && <span className="text-[var(--color-serges-blue)]">· manual</span>}
            {item.movida && <span className="text-[var(--color-serges-blue)]">· movida</span>}
            {progressoTexto(item) && <span className="text-[var(--color-ink)]">· {progressoTexto(item)}</span>}
          </div>
        </button>
        <div className="flex flex-col items-end gap-1">
          <Selos ro={ro} />
        </div>
      </div>
      <div className="mt-2">
        <QuickActions ro={ro} />
      </div>
    </div>
  );
}
