import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { resolveItem, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { fromISODate } from '../../domain/dateUtils';
import { DOW_LONGO, MESES, todayISO, TIPO_LABEL, urgenciaAttr } from '../format';
import { isAguardando } from '../../domain/resolve';
import { progressoTexto } from '../../domain/stateMachine';
import { Selos } from './Selos';
import { QuickActions } from './QuickActions';
import { ObligationCard } from './ObligationCard';
import { TudoEmDia } from './TudoEmDia';

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

  const concluidas = doDia.filter((ro) => ro.estado === 'concluida').length;
  const total = doDia.length;
  const pct = total === 0 ? 0 : Math.round((concluidas / total) * 100);
  const isToday = anchorISO === today;

  const atrasadasDia = doDia.filter((ro) => ro.atrasada).length;

  return (
    <div className="mx-auto max-w-[760px]">
      {/* Cabeçalho do dia: a data com presença + progresso legível de relance */}
      <div className="mb-[var(--spacing-16)] flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1">
        <div className="flex items-baseline gap-3">
          <span className={`display text-[44px] leading-none ${isToday ? 'text-[var(--color-serges-blue-strong)]' : 'text-[var(--color-ink)]'}`}>
            {String(d.getUTCDate()).padStart(2, '0')}
          </span>
          <div className="pb-0.5">
            <div className="text-[length:var(--text-subheading)] font-medium capitalize text-[var(--color-ink)]">
              {DOW_LONGO[d.getUTCDay()]}
              {isToday && <span className="ml-2 rounded-full bg-[var(--color-serges-blue-tint)] px-2 py-0.5 text-[length:var(--text-caption)] font-semibold text-[#d3deff]">hoje</span>}
            </div>
            <div className="label capitalize">{MESES[d.getUTCMonth()]}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="display text-[length:var(--text-title)] text-[var(--color-ink)]">
            {concluidas}<span className="text-[var(--color-ink-faint)]">/{total}</span>
          </div>
          <div className="label">
            concluídas
            {atrasadasDia > 0 && <span className="ml-2 font-semibold text-[var(--color-overdue)]">{atrasadasDia} atrasada{atrasadasDia > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--color-serges-blue)] transition-[width] duration-300"
            style={{ width: `${pct}%`, transitionTimingFunction: 'var(--ease)' }}
          />
        </div>
      </div>

      {/* Checklist do dia — linhas com trilho de urgência */}
      {total === 0 ? (
        <TudoEmDia texto="Nenhuma obrigação com prazo neste dia." />
      ) : (
        <div className="list-stack">
          {doDia.map((ro) => {
            const { item, estado } = ro;
            const done = estado === 'concluida';
            return (
              <div
                key={item.id}
                data-urgencia={urgenciaAttr({ atrasada: ro.atrasada, concluido: done, critico: ro.critico })}
                className="obl-row"
              >
                <div className="flex items-start gap-3">
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
                      {progressoTexto(item) && <span className="text-[var(--color-ink)]">· {progressoTexto(item)}</span>}
                    </div>
                  </button>
                  <Selos ro={ro} />
                </div>
                <div className="mt-2">
                  <QuickActions ro={ro} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aguardando.length > 0 && <AguardandoContratante itens={aguardando} onSelect={onSelect} />}
    </div>
  );
}

// Bloco destacado das obrigações que dependem do contratante: sem data, mas
// importantes. Renderizadas como cards de tarefa (com contato e status).
export function AguardandoContratante({
  itens,
  onSelect,
}: {
  itens: ResolvedObligation[];
  onSelect: (ro: ResolvedObligation) => void;
}) {
  return (
    <section className="well mt-[var(--spacing-24)] p-[var(--spacing-16)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-serges-blue-tint)] text-[var(--color-serges-blue-strong)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
        </span>
        <h3 className="text-[length:var(--text-subheading)]">Aguardando o contratante</h3>
        <span className="chip">{itens.length}</span>
      </div>
      <p className="label mb-3">Sem data definida, mas críticas — cobre o contratante para liberar o faturamento.</p>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {itens.map((ro) => (
          <ObligationCard key={ro.item.id} ro={ro} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
