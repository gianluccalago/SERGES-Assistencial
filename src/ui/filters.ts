import type { ResolvedObligation } from './useObligations';

export interface Filtros {
  projeto: string; // id ou 'todos'
  escalista: string; // nome ou 'todos'
}

export function applyFiltros(items: ResolvedObligation[], f: Filtros): ResolvedObligation[] {
  return items.filter(
    (ro) =>
      (f.projeto === 'todos' || ro.item.projetoId === f.projeto) &&
      (f.escalista === 'todos' || ro.item.responsavel === f.escalista),
  );
}
