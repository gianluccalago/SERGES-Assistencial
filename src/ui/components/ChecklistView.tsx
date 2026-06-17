import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { useMonthObligations, type ResolvedObligation } from '../useObligations';
import { applyFiltros, type Filtros } from '../filters';
import { addCalendarDays, fromISODate, toISODate } from '../../domain/dateUtils';
import { ESTADO_LABEL, TIPO_LABEL, estadoChipClass, formatDateShort, MESES } from '../format';
import { progressoTexto } from '../../domain/stateMachine';

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
  const [soPendentes, setSoPendentes] = useState(false);
  const [sel, setSel] = useState<Record<string, ResolvedObligation>>({});
  const [responsavel, setResponsavel] = useState('');

  const resolvido = (ro: ResolvedObligation) =>
    ro.estado === 'concluida' || ro.item.resolucaoMes === 'semAtuacao';
  const visiveis = soPendentes ? items.filter((ro) => !resolvido(ro)) : items;

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
    const lista = Object.values(sel).filter((ro) => ro.estado !== 'concluida' && ro.podeConcluir);
    if (lista.length) store.batchMark(lista.map((ro) => ro.item), 'concluida', responsavel || undefined);
    setSel({});
  }

  return (
    <div className="pb-24">
      {/* Progresso */}
      <div className="card mb-[var(--spacing-16)] p-[var(--spacing-20)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="label uppercase">Progresso do mês · {MESES[month - 1]} de {year}</div>
            <div className="text-[length:var(--text-title)] font-semibold">
              {concluidas}/{total}
              <span className="label ml-2 font-normal">concluídas</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[length:var(--text-label)]">
            <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
            Só pendentes
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {porProjeto.map((p) => (
            <div key={p.nome} className="flex justify-between text-[length:var(--text-caption)]">
              <span className="truncate text-[var(--color-ink-soft)]">{p.nome}</span>
              <span className={p.ok === p.total ? 'text-[var(--color-done)]' : 'text-[var(--color-ink)]'}>
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
        <Grupo titulo="Aguardando retorno de terceiro (sem prazo)">
          {grupos.semPrazo.map((ro) => (
            <Row key={ro.item.id} ro={ro} selecionado={!!sel[ro.item.id]} onToggle={() => toggleSel(ro)} onOpen={() => onSelect(ro)} projetoNome={nomeProjeto(ro, store)} aguardandoContato={contatoCobranca(ro, store)} />
          ))}
        </Grupo>
      )}

      {/* Barra de marcação em lote (repasse) */}
      {selKeys.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-12)] shadow-[var(--shadow-pop)]">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-[var(--spacing-16)]">
            <span className="font-medium">{selKeys.length} selecionada(s)</span>
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
function contatoCobranca(ro: ResolvedObligation, store: ReturnType<typeof useStore>): string | undefined {
  const p = ro.item.projetoId ? store.state.projects.find((x) => x.id === ro.item.projetoId) : undefined;
  return p?.contatoPrimario;
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-[var(--spacing-20)]">
      <div className="label mb-2 uppercase">{titulo}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  ro,
  selecionado,
  onToggle,
  onOpen,
  projetoNome,
  aguardandoContato,
}: {
  ro: ResolvedObligation;
  selecionado: boolean;
  onToggle: () => void;
  onOpen: () => void;
  projetoNome?: string;
  aguardandoContato?: string;
}) {
  const aguardando = ro.estado === 'aguardandoInput';
  const done = ro.estado === 'concluida';
  return (
    <div className={`card flex items-center gap-3 p-[var(--spacing-12)] ${ro.atrasada ? 'border-l-[3px] border-l-[var(--color-overdue)]' : ''}`}>
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 accent-[var(--color-serges-blue)]"
        checked={selecionado}
        disabled={aguardando || done || !ro.podeConcluir}
        title={aguardando ? 'Aguarda o contratante: registre o retorno no detalhe' : !ro.podeConcluir ? 'Conclusão bloqueada — veja o detalhe' : undefined}
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
          {aguardando && aguardandoContato && <span className="text-[var(--color-ink-soft)]">· cobrar {aguardandoContato}</span>}
        </div>
      </button>
      <span className={estadoChipClass(ro.estado)}>{ESTADO_LABEL[ro.estado]}</span>
    </div>
  );
}
