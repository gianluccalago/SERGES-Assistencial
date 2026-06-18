import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Papel, Perfil } from '../../auth/AuthProvider';

const PAPEL_LABEL: Record<Papel, string> = { gestor: 'Gestor', equipe: 'Equipe' };

export function UsersAdmin() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase.from('profiles').select('*').order('email');
    if (error) setErro(error.message);
    else setPerfis((data ?? []) as Perfil[]);
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function mudarPapel(id: string, role: Papel) {
    setPerfis((ps) => ps.map((p) => (p.id === id ? { ...p, role } : p)));
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) {
      setErro(error.message);
      void carregar();
    }
  }

  return (
    <div className="space-y-[var(--spacing-20)]">
      <section className="card p-[var(--spacing-16)]">
        <h2 className="mb-3 text-[length:var(--text-subheading)]">Usuários</h2>
        {erro && <p className="mb-2 text-[length:var(--text-label)] text-[var(--color-overdue)]">{erro}</p>}
        {carregando ? (
          <p className="text-[var(--color-ink-soft)]">Carregando…</p>
        ) : perfis.length === 0 ? (
          <p className="text-[var(--color-ink-soft)]">Nenhum usuário cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {perfis.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--color-ink)]">{p.nome || p.email}</div>
                  <div className="truncate text-[length:var(--text-label)] text-[var(--color-ink-soft)]">{p.email}</div>
                </div>
                <select className="select w-auto" value={p.role} onChange={(e) => mudarPapel(p.id, e.target.value as Papel)}>
                  {(Object.keys(PAPEL_LABEL) as Papel[]).map((r) => (
                    <option key={r} value={r}>{PAPEL_LABEL[r]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-[var(--spacing-16)] text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
        <h3 className="mb-2 text-[length:var(--text-label)] font-medium uppercase tracking-wide text-[var(--color-ink)]">Como adicionar um usuário</h3>
        <ol className="list-decimal space-y-1 pl-5">
          <li>No Supabase, vá em <strong>Authentication → Users → Add user</strong> e crie com e-mail e senha.</li>
          <li>O perfil é criado automaticamente como <strong>equipe</strong> no primeiro login.</li>
          <li>Aqui nesta tela, ajuste o papel para <strong>Gestor</strong> se necessário.</li>
        </ol>
      </section>
    </div>
  );
}
