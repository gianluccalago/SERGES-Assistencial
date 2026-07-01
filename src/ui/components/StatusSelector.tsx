import { useStore } from '../../state/store';
import { useGestorGate } from '../../auth/AuthProvider';
import type { ResolvedObligation } from '../useObligations';
import type { ObligationEstado } from '../../domain/types';
import { ESTADO_LABEL } from '../format';

const ORDEM: ObligationEstado[] = ['pendente', 'aguardandoInput', 'emAprovacao', 'concluida'];

// Cor sutil do texto por estado (vermelho fica reservado só para "atrasada").
const COR: Record<ObligationEstado, string> = {
  pendente: 'text-[var(--color-ink)]',
  aguardandoInput: 'text-[var(--color-ink-soft)]',
  emAprovacao: 'text-[var(--color-serges-blue)]',
  concluida: 'text-[var(--color-done)]',
};

// Seletor de status compacto (pill). Troca livre entre os quatro estados,
// para frente e para trás, sem bloqueios.
export function StatusSelector({ ro }: { ro: ResolvedObligation }) {
  const store = useStore();
  const { isGestor } = useGestorGate();
  const { item, estado } = ro;
  // Aprovar o SLA (concluir a partir de "Em aprovação") é exclusivo do gestor.
  const aprovacaoBloqueada = (s: ObligationEstado) => !isGestor && estado === 'emAprovacao' && s === 'concluida';
  return (
    <select
      value={estado}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const novo = e.target.value as ObligationEstado;
        if (aprovacaoBloqueada(novo)) return;
        store.setEstado(item, novo);
      }}
      aria-label="Status"
      className={`w-auto cursor-pointer appearance-none rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] bg-[length:14px] bg-[right_8px_center] bg-no-repeat py-1 pl-3 pr-7 text-[length:var(--text-caption)] font-medium transition-colors duration-150 hover:border-[var(--color-serges-blue)] focus:border-[var(--color-serges-blue)] focus:outline-none ${COR[estado]}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A9B4D6' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {ORDEM.map((s) => (
        <option key={s} value={s} disabled={aprovacaoBloqueada(s)} className="text-[var(--color-ink)]">
          {ESTADO_LABEL[s]}
          {aprovacaoBloqueada(s) ? ' (gestor)' : ''}
        </option>
      ))}
    </select>
  );
}
