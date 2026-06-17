import { useMemo, useState } from 'react';
import { useMonthObligations, type ResolvedObligation } from '../useObligations';
import { useStore } from '../../state/store';
import { ESTADO_LABEL, TIPO_LABEL, estadoChipClass, formatDateLong } from '../format';
import type { ObligationEstado } from '../../domain/types';

const ORDEM_ESTADO: ObligationEstado[] = [
  'atrasada',
  'escalada',
  'emCobranca',
  'aguardandoRetorno',
  'pendente',
  'concluida',
];

export function ListView({
  year,
  month,
  onSelect,
}: {
  year: number;
  month: number;
  onSelect: (item: ResolvedObligation) => void;
}) {
  const items = useMonthObligations(year, month);
  const store = useStore();
  const [estadoFiltro, setEstadoFiltro] = useState<ObligationEstado | 'todos'>('todos');
  const [projetoFiltro, setProjetoFiltro] = useState<string>('todos');
  const [escalistaFiltro, setEscalistaFiltro] = useState<string>('todos');

  const escalistas = useMemo(() => {
    const set = new Set<string>();
    store.state.projects.forEach((p) => p.escalista && set.add(p.escalista));
    return [...set].sort();
  }, [store.state.projects]);

  const filtrados = useMemo(() => {
    return items
      .filter((it) => (estadoFiltro === 'todos' ? true : it.estado === estadoFiltro))
      .filter((it) => (projetoFiltro === 'todos' ? true : it.obligation.projetoId === projetoFiltro))
      .filter((it) =>
        escalistaFiltro === 'todos' ? true : it.obligation.responsavel === escalistaFiltro,
      )
      .sort((a, b) => {
        const ea = ORDEM_ESTADO.indexOf(a.estado);
        const eb = ORDEM_ESTADO.indexOf(b.estado);
        if (ea !== eb) return ea - eb;
        return (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999');
      });
  }, [items, estadoFiltro, projetoFiltro, escalistaFiltro]);

  return (
    <div>
      <div className="mb-[var(--spacing-20)] flex flex-wrap gap-3">
        <Select label="Estado" value={estadoFiltro} onChange={(v) => setEstadoFiltro(v as ObligationEstado | 'todos')}>
          <option value="todos">Todos</option>
          {ORDEM_ESTADO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABEL[e]}
            </option>
          ))}
        </Select>
        <Select label="Projeto" value={projetoFiltro} onChange={setProjetoFiltro}>
          <option value="todos">Todos</option>
          {store.state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
        <Select label="Escalista" value={escalistaFiltro} onChange={setEscalistaFiltro}>
          <option value="todos">Todos</option>
          {escalistas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-px">
        {filtrados.length === 0 && <div className="label">Nenhuma obrigação com os filtros atuais.</div>}
        {filtrados.map((it) => (
          <button
            key={it.obligation.id}
            onClick={() => onSelect(it)}
            className={`surface hairline flex w-full items-center gap-4 p-[var(--spacing-16)] text-left ${
              it.estado === 'atrasada' ? 'border-l-[3px] border-l-[var(--color-ember)]' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className={`truncate ${it.estado === 'concluida' ? 'line-through opacity-50' : 'text-[var(--color-bone)]'}`}>
                {it.obligation.titulo}
              </div>
              <div className="label mt-1 truncate">
                {TIPO_LABEL[it.obligation.tipo]}
                {it.prazo ? ` · ${formatDateLong(it.prazo)}` : ' · sem prazo'}
                {it.obligation.responsavel ? ` · ${it.obligation.responsavel}` : ''}
              </div>
            </div>
            {it.aprovacaoEstourada && (
              <span className="chip border-[var(--color-ember)] text-[var(--color-ember)]">24h+</span>
            )}
            <span className={estadoChipClass(it.estado)}>{ESTADO_LABEL[it.estado]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label uppercase">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
