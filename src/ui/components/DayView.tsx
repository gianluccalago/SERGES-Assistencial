import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { resolveItem, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { fromISODate } from '../../domain/dateUtils';
import {
  DOW_LONGO,
  MESES,
  todayISO,
  ESTADO_LABEL,
  TIPO_LABEL,
  estadoChipClass,
  itemAccentClass,
} from '../format';
import { isAguardando } from '../../domain/resolve';
import type { CalendarItem, ObligationEstado } from '../../domain/types';

export function DayView({
  anchorISO,
  filtros,
  onSelect,
}: {
  anchorISO: string;
  filtros: Filtros;
  onSelect: (ro: ResolvedObligation) => void;
}) {
  const store = useStore();
  const today = todayISO();
  const nowISO = new Date().toISOString();
  const d = fromISODate(anchorISO);

  const { doDia, aguardando } = useMemo(() => {
    const [y, m] = [d.getUTCFullYear(), d.getUTCMonth() + 1];
    const items = applyFiltros(
      store.itemsFor(y, m).map((it) => resolveItem(it, today, nowISO)),
      filtros,
    );
    return {
      doDia: items
        .filter((ro) => ro.prazo === anchorISO)
        .sort((a, b) => Number(a.estado === 'concluida') - Number(b.estado === 'concluida')),
      aguardando: items.filter((ro) => isAguardando(ro.item)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state, anchorISO, filtros, today]);

  function setEstado(item: CalendarItem, estado: ObligationEstado) {
    store.setEstado(item, estado);
  }

  const concluidas = doDia.filter((ro) => ro.estado === 'concluida').length;
  const total = doDia.length;
  const pct = total === 0 ? 0 : Math.round((concluidas / total) * 100);
  const isToday = anchorISO === today;

  return (
    <div className="mx-auto max-w-[760px]">
      {/* Cabeçalho do dia + progresso */}
      <div className="card mb-[var(--spacing-16)] p-[var(--spacing-20)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="label uppercase">
              {DOW_LONGO[d.getUTCDay()]}
              {isToday && ' · hoje'}
            </div>
            <h2 className="text-[length:var(--text-title)]">
              {d.getUTCDate()} de {MESES[d.getUTCMonth()]}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[length:var(--text-heading)] font-semibold text-[var(--color-ink)]">
              {concluidas}/{total}
            </div>
            <div className="label">concluídas</div>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
          <div
            className="h-full rounded-full bg-[var(--color-serges-blue)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Checklist do dia */}
      <div className="space-y-2">
        {total === 0 && (
          <div className="card p-[var(--spacing-24)] text-center">
            <div className="label">Nenhuma obrigação com prazo neste dia.</div>
          </div>
        )}
        {doDia.map((ro) => {
          const { item, estado } = ro;
          const done = estado === 'concluida';
          const checkDisabled = !done && !ro.podeConcluir;
          return (
            <div
              key={item.id}
              className={`card flex items-center gap-3 p-[var(--spacing-16)] ${itemAccentClass(estado, item.critico)}`}
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-[var(--color-serges-blue)]"
                checked={done}
                disabled={checkDisabled}
                title={checkDisabled ? 'Anexe a planilha de origem antes de concluir' : undefined}
                onChange={() => setEstado(item, done ? 'pendente' : 'concluida')}
              />
              <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(ro)}>
                <div
                  className={`text-[length:var(--text-body)] ${
                    done ? 'text-[var(--color-ink-soft)] line-through' : 'font-medium text-[var(--color-ink)]'
                  }`}
                >
                  {item.titulo}
                </div>
                <div className="label mt-0.5 flex flex-wrap gap-x-2">
                  <span>{TIPO_LABEL[item.tipo]}</span>
                  {item.projetoId && (
                    <span>· {store.state.projects.find((p) => p.id === item.projetoId)?.nome}</span>
                  )}
                  {item.responsavel && <span>· {item.responsavel}</span>}
                  {checkDisabled && <span className="text-[var(--color-overdue)]">· falta anexo</span>}
                </div>
              </button>
              {ro.aprovacaoEstourada && (
                <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">24h+</span>
              )}
              <span className={estadoChipClass(estado)}>{ESTADO_LABEL[estado]}</span>
            </div>
          );
        })}
      </div>

      {aguardando.length > 0 && (
        <div className="mt-[var(--spacing-24)]">
          <div className="label mb-2 uppercase">Aguardando retorno de terceiro (no mês)</div>
          <div className="flex flex-wrap gap-2">
            {aguardando.map((ro) => (
              <button key={ro.item.id} onClick={() => onSelect(ro)} className={estadoChipClass(ro.estado)}>
                {ro.item.titulo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
