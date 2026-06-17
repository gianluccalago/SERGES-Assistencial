import { useStore } from '../../state/store';
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
  const { item, estado } = ro;
  return (
    <select
      value={estado}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        store.setEstado(item, e.target.value as ObligationEstado);
      }}
      aria-label="Status"
      className={`w-auto cursor-pointer appearance-none rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] bg-[length:14px] bg-[right_8px_center] bg-no-repeat py-1 pl-3 pr-7 text-[length:var(--text-caption)] font-medium hover:border-[var(--color-serges-blue)] focus:border-[var(--color-serges-blue)] focus:outline-none ${COR[estado]}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235B6170' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {ORDEM.map((s) => (
        <option key={s} value={s} className="text-[var(--color-ink)]">
          {ESTADO_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
