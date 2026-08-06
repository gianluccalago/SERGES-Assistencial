import { useState } from 'react';
import type { Subtarefa } from '../../domain/types';

/**
 * Checklist das etapas de uma obrigação: criar, renomear, marcar, reordenar e
 * remover. Grava na hora (é acompanhamento, não formulário) — por isso não
 * depende do "Salvar" da tela que o contém.
 *
 * Etapa concluída CONTINUA na lista, com o checkbox marcado e o texto editável:
 * dá para conferir depois e desmarcar se voltar atrás. O "ocultar concluídas" é
 * opcional e nunca esconde de vez — deixa sempre um atalho para trazer de volta.
 */
export function Subtarefas({
  valor,
  onChange,
}: {
  valor?: Subtarefa[];
  onChange: (s: Subtarefa[]) => void;
}) {
  const lista = valor ?? [];
  const [novo, setNovo] = useState('');
  const [esconderFeitas, setEsconderFeitas] = useState(false);
  const feitas = lista.filter((s) => s.feita).length;
  const pct = lista.length ? Math.round((feitas / lista.length) * 100) : 0;
  const escondendo = esconderFeitas && feitas > 0;

  const set = (id: string, patch: Partial<Subtarefa>) =>
    onChange(lista.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  function adicionar() {
    const titulo = novo.trim();
    if (!titulo) return;
    onChange([...lista, { id: `st-${crypto.randomUUID().slice(0, 8)}`, titulo }]);
    setNovo('');
  }

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const arr = [...lista];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="label uppercase">Etapas</span>
        <span className="flex items-center gap-3">
          {feitas > 0 && (
            <button
              className="label underline decoration-dotted underline-offset-2 hover:text-[var(--color-ink)]"
              onClick={() => setEsconderFeitas((v) => !v)}
            >
              {escondendo ? 'mostrar concluídas' : 'ocultar concluídas'}
            </button>
          )}
          {lista.length > 0 && (
            <span className={`label tabular-nums ${feitas === lista.length ? 'text-[var(--color-done)]' : ''}`}>
              {feitas} de {lista.length}
            </span>
          )}
        </span>
      </div>

      {lista.length > 0 && (
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%`, backgroundColor: feitas === lista.length ? 'var(--color-done)' : 'var(--color-serges-blue)' }}
          />
        </div>
      )}

      <div className="space-y-1">
        {lista.map((s, i) =>
          escondendo && s.feita ? null : (
            <div key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0"
                checked={!!s.feita}
                aria-label={s.feita ? `Reabrir etapa: ${s.titulo}` : `Concluir etapa: ${s.titulo}`}
                title={s.feita ? 'Concluída — clique para reabrir' : 'Marcar como concluída'}
                onChange={(e) => set(s.id, { feita: e.target.checked })}
              />
              <input
                className={`input min-w-0 flex-1 py-1 ${s.feita ? 'text-[var(--color-ink-faint)] line-through' : ''}`}
                defaultValue={s.titulo}
                placeholder="Descreva a etapa"
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (t && t !== s.titulo) set(s.id, { titulo: t });
                  else if (!t) e.target.value = s.titulo;
                }}
              />
              <button className="btn-ghost px-1.5" title="Subir" aria-label="Subir etapa" disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
              <button className="btn-ghost px-1.5" title="Descer" aria-label="Descer etapa" disabled={i === lista.length - 1} onClick={() => mover(i, 1)}>↓</button>
              <button
                className="btn-ghost px-1.5 text-[var(--color-overdue)]"
                title="Remover etapa"
                aria-label={`Remover etapa: ${s.titulo}`}
                onClick={() => onChange(lista.filter((x) => x.id !== s.id))}
              >
                ×
              </button>
            </div>
          ),
        )}
      </div>

      {/* Nada some de vez: o que está oculto fica a um clique de voltar. */}
      {escondendo && (
        <button
          className="mt-1 flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] px-2 py-1.5 text-left text-[length:var(--text-caption)] text-[var(--color-ink-soft)] transition-colors duration-150 hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]"
          onClick={() => setEsconderFeitas(false)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-done)]">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          {feitas} concluída(s) oculta(s) — mostrar
        </button>
      )}

      <div className="mt-2 flex gap-2">
        <input
          className="input min-w-0 flex-1 py-1"
          placeholder="Adicionar etapa e apertar Enter"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <button className="btn-secondary" disabled={!novo.trim()} onClick={adicionar}>
          Adicionar
        </button>
      </div>
      {lista.length === 0 && (
        <p className="label mt-1">Quebre a tarefa em etapas para acompanhar o andamento.</p>
      )}
    </div>
  );
}
