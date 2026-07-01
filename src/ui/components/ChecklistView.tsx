import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { useMonthObligations, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { addCalendarDays, fromISODate, toISODate } from '../../domain/dateUtils';
import { TIPO_LABEL, formatDateShort, MESES, urgenciaAttr } from '../format';
import { progressoTexto } from '../../domain/stateMachine';
import { QuickActions } from './QuickActions';
import { Selos } from './Selos';
import { TudoEmDia } from './TudoEmDia';

function weekStart(iso: string): string {
  const d = fromISODate(iso);
  return toISODate(addCalendarDays(d, -d.getUTCDay()));
}

export function ChecklistView({
  year,
  month,
  filtros,
  onSelect,
}: {
  year: number;
  month: number;
  filtros: Filtros;
  onSelect: (ro: ResolvedObligation) => void;
}) {
  const store = useStore();
  const items = applyFiltros(useMonthObligations(year, month), filtros);
  const [sel, setSel] = useState<Record<string, ResolvedObligation>>({});
  const [responsavel, setResponsavel] = useState('');
  const [verConcluidas, setVerConcluidas] = useState(false);

  const resolvido = (ro: ResolvedObligation) =>
    ro.estado === 'concluida' || ro.item.resolucaoMes === 'semAtuacao';
  // Por padrão mostra só pendentes; as concluídas ficam recolhidas e expansíveis.
  const visiveis = items.filter((ro) => !resolvido(ro));
  const resolvidas = items.filter(resolvido);

  // Progresso
  const concluidas = items.filter((ro) => ro.estado === 'concluida').length;
  const total = items.length;

  const porProjeto = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; ok: number }>();
    for (const ro of items) {
      const pid = ro.item.projetoId ?? '—';
      const nome = ro.item.projetoId
        ? store.state.projects.find((p) => p.id === ro.item.projetoId)?.nome ?? pid
        : 'Sem projeto';
      const cur = map.get(pid) ?? { nome, total: 0, ok: 0 };
      cur.total++;
      if (ro.estado === 'concluida') cur.ok++;
      map.set(pid, cur);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items, store.state.projects]);

  // Agrupa por semana; aguardando/sem prazo num grupo à parte.
  const grupos = useMemo(() => {
    const semana = new Map<string, ResolvedObligation[]>();
    const semPrazo: ResolvedObligation[] = [];
    for (const ro of visiveis) {
      if (!ro.prazo) semPrazo.push(ro);
      else {
        const k = weekStart(ro.prazo);
        const arr = semana.get(k) ?? [];
        arr.push(ro);
        semana.set(k, arr);
      }
    }
    const ordenadas = [...semana.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, arr] of ordenadas) {
      arr.sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '') ||
        (a.item.projetoId ?? '').localeCompare(b.item.projetoId ?? ''));
    }
    return { ordenadas, semPrazo };
  }, [visiveis]);

  const selKeys = Object.keys(sel);

  function toggleSel(ro: ResolvedObligation) {
    setSel((s) => {
      const n = { ...s };
      if (n[ro.item.id]) delete n[ro.item.id];
      else n[ro.item.id] = ro;
      return n;
    });
  }

  function confirmarLote() {
    const lista = Object.values(sel).filter((ro) => ro.estado !== 'concluida');
    if (lista.length) store.batchMark(lista.map((ro) => ro.item), 'concluida', responsavel || undefined);
    setSel({});
  }

  return (
    <div className="pb-24">
      {/* Progresso do mês — número com presença + varredura por projeto */}
      <div className="card mb-[var(--spacing-16)] p-[var(--spacing-20)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="label uppercase">Progresso do mês · {MESES[month - 1]} de {year}</div>
            <div className="display mt-1 text-[length:var(--text-display)] leading-none text-[var(--color-ink)]">
              {concluidas}<span className="text-[var(--color-ink-faint)]">/{total}</span>
            </div>
          </div>
          <div className="hidden h-1.5 flex-1 self-center overflow-hidden rounded-full bg-[var(--color-surface-2)] sm:block">
            <div
              className="h-full rounded-full bg-[var(--color-serges-blue)] transition-[width] duration-300"
              style={{ width: `${total ? Math.round((concluidas / total) * 100) : 0}%` }}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-[var(--color-line)] pt-3 sm:grid-cols-3">
          {porProjeto.map((p) => (
            <div key={p.nome} className="flex justify-between text-[length:var(--text-caption)]">
              <span className="truncate text-[var(--color-ink-soft)]">{p.nome}</span>
              <span className={`tabular-nums ${p.ok === p.total ? 'text-[var(--color-done)]' : 'text-[var(--color-ink)]'}`}>
                {p.ok}/{p.total}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grupos por semana */}
      {grupos.ordenadas.map(([wk, arr]) => {
        const end = formatDateShort(toISODate(addCalendarDays(fromISODate(wk), 6)));
        return (
          <Grupo key={wk} titulo={`Semana de ${formatDateShort(wk)} – ${end}`}>
            {arr.map((ro) => (
              <Row key={ro.item.id} ro={ro} selecionado={!!sel[ro.item.id]} onToggle={() => toggleSel(ro)} onOpen={() => onSelect(ro)} projetoNome={nomeProjeto(ro, store)} />
            ))}
          </Grupo>
        );
      })}

      {grupos.semPrazo.length > 0 && (
        <Grupo titulo="Aguardando input do contratante (sem prazo)">
          {grupos.semPrazo.map((ro) => (
            <Row key={ro.item.id} ro={ro} selecionado={!!sel[ro.item.id]} onToggle={() => toggleSel(ro)} onOpen={() => onSelect(ro)} projetoNome={nomeProjeto(ro, store)} />
          ))}
        </Grupo>
      )}

      {visiveis.length === 0 && <TudoEmDia />}

      {/* Concluídas / resolvidas — recolhidas e expansíveis */}
      {resolvidas.length > 0 && (
        <div className="mt-[var(--spacing-16)]">
          <button className="btn-ghost inline-flex items-center gap-1.5" onClick={() => setVerConcluidas((v) => !v)}>
            Concluídas e resolvidas ({resolvidas.length})
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${verConcluidas ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {verConcluidas && (
            <div className="list-stack mt-2">
              {resolvidas.map((ro) => (
                <Row key={ro.item.id} ro={ro} selecionado={!!sel[ro.item.id]} onToggle={() => toggleSel(ro)} onOpen={() => onSelect(ro)} projetoNome={nomeProjeto(ro, store)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra de marcação em lote (repasse) — flutua acima do conteúdo */}
      {selKeys.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-[var(--spacing-12)] pb-[max(var(--spacing-12),env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[920px] flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] p-[var(--spacing-12)] shadow-[var(--shadow-pop)]">
            <span className="display px-1 text-[length:var(--text-subheading)] text-[var(--color-serges-blue-strong)]">{selKeys.length}</span>
            <span className="-ml-2 text-[length:var(--text-label)] text-[var(--color-ink-soft)]">selecionada(s)</span>
            <input
              className="input w-auto flex-1 min-w-[180px]"
              placeholder="Responsável pelo repasse (opcional)"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            />
            <button className="btn-secondary" onClick={() => setSel({})}>
              Limpar
            </button>
            <button className="btn-primary" onClick={confirmarLote}>
              Marcar concluídas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function nomeProjeto(ro: ResolvedObligation, store: ReturnType<typeof useStore>): string | undefined {
  return ro.item.projetoId ? store.state.projects.find((p) => p.id === ro.item.projetoId)?.nome : undefined;
}
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-[var(--spacing-20)]">
      <div className="label mb-2 uppercase">{titulo}</div>
      <div className="list-stack">{children}</div>
    </div>
  );
}

function Row({
  ro,
  selecionado,
  onToggle,
  onOpen,
  projetoNome,
}: {
  ro: ResolvedObligation;
  selecionado: boolean;
  onToggle: () => void;
  onOpen: () => void;
  projetoNome?: string;
}) {
  const done = ro.estado === 'concluida';
  return (
    <div className="obl-row" data-urgencia={urgenciaAttr({ atrasada: ro.atrasada, concluido: done, critico: ro.critico, aguardando: ro.estado === 'aguardandoInput' })}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 accent-[var(--color-serges-blue)]"
          checked={selecionado}
          disabled={done}
          title="Selecionar para marcação em lote (repasse)"
          onChange={onToggle}
        />
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className={`text-[length:var(--text-label)] ${done ? 'text-[var(--color-ink-soft)] line-through' : 'font-medium'}`}>
            {ro.item.titulo}
          </div>
          <div className="label mt-0.5 flex flex-wrap gap-x-2">
            <span>{TIPO_LABEL[ro.item.tipo]}</span>
            {ro.prazo && <span>· {formatDateShort(ro.prazo)}</span>}
            {projetoNome && <span>· {projetoNome}</span>}
            {progressoTexto(ro.item) && <span className="text-[var(--color-ink)]">· {progressoTexto(ro.item)}</span>}
          </div>
        </button>
        <Selos ro={ro} />
      </div>
      <div className="mt-2">
        <QuickActions ro={ro} />
      </div>
    </div>
  );
}
