import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import type { ObligationEstado } from '../../domain/types';
import { ESTADO_LABEL } from '../format';

const ORDEM: ObligationEstado[] = ['pendente', 'aguardandoInput', 'emAprovacao', 'concluida'];

// Seletor de status: os quatro estados, trocáveis livremente para frente e para
// trás, sem bloqueios. É a forma simples de avançar/reverter uma obrigação.
export function StatusSelector({ ro }: { ro: ResolvedObligation }) {
  const store = useStore();
  const { item, estado } = ro;
  return (
    <select
      className="select w-auto"
      value={estado}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        store.setEstado(item, e.target.value as ObligationEstado);
      }}
      aria-label="Status"
    >
      {ORDEM.map((s) => (
        <option key={s} value={s}>
          {ESTADO_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
