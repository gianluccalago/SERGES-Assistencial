import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import { ESTADO_LABEL, TIPO_LABEL, estadoChipClass, itemAccentClass, formatDateShort } from '../format';
import { progressoTexto } from '../../domain/stateMachine';
import { Selos } from './Selos';

interface Props {
  ro: ResolvedObligation;
  onSelect: (ro: ResolvedObligation) => void;
  variant?: 'week' | 'list';
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export function ObligationCard({ ro, onSelect, variant = 'week', draggable, onDragStart }: Props) {
  const store = useStore();
  const { item, estado, prazo } = ro;
  const projeto = item.projetoId
    ? store.state.projects.find((p) => p.id === item.projetoId)?.nome
    : undefined;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onSelect(ro)}
      className={`card flex w-full items-start gap-3 p-[var(--spacing-12)] text-left transition hover:border-[var(--color-serges-blue)] ${itemAccentClass(
        { atrasada: ro.atrasada, concluido: estado === 'concluida', critico: ro.critico },
      )} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="min-w-0 flex-1">
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
          {variant === 'list' && prazo && <span>· {formatDateShort(prazo)}</span>}
          {item.isManual && <span className="text-[var(--color-serges-blue)]">· manual</span>}
          {item.movida && <span className="text-[var(--color-serges-blue)]">· movida</span>}
          {progressoTexto(item) && <span className="text-[var(--color-ink)]">· {progressoTexto(item)}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={estadoChipClass(estado)}>{ESTADO_LABEL[estado]}</span>
        <Selos ro={ro} />
      </div>
    </button>
  );
}
