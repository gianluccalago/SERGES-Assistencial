import { useState } from 'react';
import { useStore } from '../../state/store';
import { brazilianHolidays } from '../../domain/holidays';
import { formatDateLong } from '../format';

export function HolidaysAdmin({ year }: { year: number }) {
  const store = useStore();
  const [date, setDate] = useState(`${year}-01-01`);
  const [nome, setNome] = useState('');
  const [escopo, setEscopo] = useState('Curitiba');

  const nacionais = brazilianHolidays(year);

  return (
    <div className="grid gap-[var(--spacing-24)] lg:grid-cols-2">
      <div>
        <h2 className="mb-3 text-[length:var(--text-heading)]">Feriados de {year}</h2>
        <div className="label mb-2 uppercase">Nacionais (derivados)</div>
        <div className="space-y-2">
          {nacionais
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((h) => (
              <div key={h.date} className="card flex justify-between p-3 text-[length:var(--text-label)]">
                <span className="text-[var(--color-ink)]">{h.nome}</span>
                <span className="label">{formatDateLong(h.date)}</span>
              </div>
            ))}
        </div>

        <div className="label mb-2 mt-[var(--spacing-20)] uppercase">Municipais / extras</div>
        <div className="space-y-2">
          {store.state.extraHolidays.length === 0 && <div className="label">Nenhum feriado municipal cadastrado.</div>}
          {store.state.extraHolidays.map((h) => (
            <div key={h.date} className="card flex items-center justify-between p-3 text-[length:var(--text-label)]">
              <span className="text-[var(--color-ink)]">
                {h.nome} <span className="label">· {h.escopo}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="label">{formatDateLong(h.date)}</span>
                <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => store.removeHoliday(h.date)}>
                  Remover
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card h-fit space-y-3 p-[var(--spacing-20)]">
        <h3 className="text-[length:var(--text-subheading)]">Adicionar feriado municipal</h3>
        <label className="block">
          <span className="label mb-1 block uppercase">Data</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="label mb-1 block uppercase">Nome</span>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="block">
          <span className="label mb-1 block uppercase">Escopo (município)</span>
          <input className="input" value={escopo} onChange={(e) => setEscopo(e.target.value)} />
        </label>
        <button
          className="btn-primary"
          disabled={!date || !nome}
          onClick={() => {
            store.addHoliday({ date, nome, escopo });
            setNome('');
          }}
        >
          Adicionar
        </button>
        <p className="label">Adicionar feriado recalcula os prazos do calendário.</p>
      </div>
    </div>
  );
}
