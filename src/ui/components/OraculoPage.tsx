import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { Markdown } from './Markdown';
import playbook from '../../data/playbook.md?raw';

// Divide o playbook em seções por título de nível 2 (##) para a busca.
function sections(md: string): { titulo: string; corpo: string }[] {
  const out: { titulo: string; corpo: string }[] = [];
  let cur: { titulo: string; corpo: string } | null = null;
  for (const line of md.split('\n')) {
    if (/^##\s/.test(line)) {
      if (cur) out.push(cur);
      cur = { titulo: line.replace(/^##\s/, ''), corpo: '' };
    } else if (cur) {
      cur.corpo += line + '\n';
    } else {
      // preâmbulo (título # e intro)
      if (!out.length && !cur) {
        cur = { titulo: '__intro__', corpo: line + '\n' };
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function OraculoPage() {
  const store = useStore();
  const [busca, setBusca] = useState('');
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [url, setUrl] = useState(store.config.oraculoUrl);

  const secs = useMemo(() => sections(playbook), []);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return secs;
    return secs.filter((s) => (s.titulo + ' ' + s.corpo).toLowerCase().includes(q));
  }, [secs, busca]);

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="mb-[var(--spacing-20)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[length:var(--text-title)]">Oráculo</h2>
          <p className="label">Base de conhecimento — consulta rápida e offline das regras.</p>
        </div>
        <a className="btn-secondary" href={store.config.oraculoUrl} target="_blank" rel="noreferrer">
          Abrir no NotebookLM ↗
        </a>
      </div>

      <input
        className="input mb-[var(--spacing-16)]"
        placeholder="Buscar no playbook…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="card p-[var(--spacing-24)]">
        {filtradas.length === 0 && <div className="label">Nada encontrado para “{busca}”.</div>}
        {filtradas.map((s) => (
          <Markdown key={s.titulo} source={s.titulo === '__intro__' ? s.corpo : `## ${s.titulo}\n${s.corpo}`} />
        ))}
      </div>

      {/* Configuração da URL do Oráculo (§10) */}
      <div className="card mt-[var(--spacing-20)] p-[var(--spacing-16)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="label uppercase">URL do notebook (NotebookLM)</div>
            <div className="truncate text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
              {store.config.oraculoUrl}
            </div>
          </div>
          <button className="btn-secondary" onClick={() => setEditandoUrl((v) => !v)}>
            {editandoUrl ? 'Cancelar' : 'Editar'}
          </button>
        </div>
        {editandoUrl && (
          <div className="mt-3 flex gap-2">
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button
              className="btn-primary"
              onClick={() => {
                store.setConfig({ oraculoUrl: url.trim() });
                setEditandoUrl(false);
              }}
            >
              Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
