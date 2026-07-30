import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Papel, Perfil } from '../../auth/AuthProvider';
import { useAuth } from '../../auth/AuthProvider';
import { SETORES, SETOR_LABEL, type Setor } from '../../domain/types';

const PAPEL_LABEL: Record<Papel, string> = { gestor: 'Gestor', equipe: 'Equipe' };

/**
 * Criar/excluir usuário roda no banco (funções admin_criar_usuario /
 * admin_excluir_usuario, que checam o papel de gestor). Se elas ainda não
 * existirem, cai na Edge Function admin-users — e, se nenhuma das duas estiver
 * disponível, explica exatamente o que fazer em vez de um erro genérico.
 */
const FALTA_SETUP =
  'A administração de usuários ainda não foi instalada no banco. Rode o arquivo ' +
  'supabase/admin_usuarios.sql no SQL Editor do Supabase (uma vez) e tente de novo.';

/** Erro de "função inexistente" no PostgREST (não instalada ainda). */
function rpcAusente(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false;
  return e.code === 'PGRST202' || /could not find the function|does not exist/i.test(e.message ?? '');
}

async function viaEdgeFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) throw new Error(FALTA_SETUP);
  if (!data?.ok) throw new Error(data?.error || 'Operação não permitida.');
  return data;
}

async function criarUsuario(p: { email: string; senha: string; nome: string; role: Papel; setor: Setor }) {
  const { error } = await supabase.rpc('admin_criar_usuario', {
    p_email: p.email,
    p_senha: p.senha,
    p_nome: p.nome,
    p_papel: p.role,
    p_setor: p.setor,
  });
  if (!error) return;
  if (!rpcAusente(error)) throw new Error(error.message);
  await viaEdgeFunction({ action: 'create', email: p.email, password: p.senha, nome: p.nome, role: p.role });
}

async function excluirUsuario(id: string) {
  const { error } = await supabase.rpc('admin_excluir_usuario', { p_id: id });
  if (!error) return;
  if (!rpcAusente(error)) throw new Error(error.message);
  await viaEdgeFunction({ action: 'delete', id });
}

/** Papel e nome ficam em public.profiles — o RLS já permite ao gestor gravar,
 * então não precisa de servidor nenhum. */
async function atualizarPerfil(id: string, patch: { role?: Papel; nome?: string; setor?: Setor }) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export function UsersAdmin() {
  const { perfil: eu } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({ email: '', senha: '', nome: '', role: 'equipe' as Papel, setor: 'assistencial' as Setor });
  const [salvando, setSalvando] = useState(false);

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

  async function criar() {
    setErro(null);
    setSalvando(true);
    try {
      await criarUsuario({ email: novo.email.trim(), senha: novo.senha, nome: novo.nome.trim(), role: novo.role, setor: novo.setor });
      setNovo({ email: '', senha: '', nome: '', role: 'equipe', setor: 'assistencial' });
      setCriando(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar.');
    } finally {
      setSalvando(false);
    }
  }

  async function mudarPapel(id: string, role: Papel) {
    setErro(null);
    setPerfis((ps) => ps.map((p) => (p.id === id ? { ...p, role } : p)));
    try {
      await atualizarPerfil(id, { role });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar.');
      void carregar();
    }
  }

  async function mudarSetor(id: string, setor: Setor) {
    setErro(null);
    setPerfis((ps) => ps.map((p) => (p.id === id ? { ...p, setor } : p)));
    try {
      await atualizarPerfil(id, { setor });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao mudar o setor.');
      void carregar();
    }
  }

  async function renomear(id: string, nome: string) {
    setErro(null);
    try {
      await atualizarPerfil(id, { nome });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao renomear.');
      void carregar();
    }
  }

  async function excluir(p: Perfil) {
    if (!confirm(`Excluir o usuário ${p.email}? Esta ação não pode ser desfeita.`)) return;
    setErro(null);
    try {
      await excluirUsuario(p.id);
      setPerfis((ps) => ps.filter((x) => x.id !== p.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao excluir.');
    }
  }

  return (
    <div className="mx-auto max-w-[760px] space-y-[var(--spacing-20)]">
      <section className="card p-[var(--spacing-16)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[length:var(--text-subheading)]">Usuários</h2>
          <button className="btn-primary" onClick={() => setCriando((v) => !v)}>{criando ? 'Cancelar' : '+ Novo usuário'}</button>
        </div>

        {erro && <p className="mb-3 text-[length:var(--text-label)] text-[var(--color-overdue)]">{erro}</p>}

        {criando && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className="input" placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              <input className="input" type="email" placeholder="E-mail" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
              <input className="input" type="text" placeholder="Senha (mín. 6)" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} />
              <select className="select" value={novo.role} onChange={(e) => setNovo({ ...novo, role: e.target.value as Papel })}>
                {(Object.keys(PAPEL_LABEL) as Papel[]).map((r) => <option key={r} value={r}>{PAPEL_LABEL[r]}</option>)}
              </select>
              <label className="block sm:col-span-2">
                <span className="label mb-1 block">Setor — define qual calendário a pessoa enxerga</span>
                <select className="select" value={novo.setor} onChange={(e) => setNovo({ ...novo, setor: e.target.value as Setor })}>
                  {SETORES.map((s) => <option key={s} value={s}>{SETOR_LABEL[s]}</option>)}
                </select>
              </label>
            </div>
            <button className="btn-primary mt-3" disabled={salvando || !novo.email || novo.senha.length < 6} onClick={criar}>
              {salvando ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        )}

        {carregando ? (
          <p className="text-[var(--color-ink-soft)]">Carregando…</p>
        ) : perfis.length === 0 ? (
          <p className="text-[var(--color-ink-soft)]">Nenhum usuário cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {perfis.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <input
                    className="input w-full max-w-[280px] py-1 font-medium"
                    defaultValue={p.nome || ''}
                    placeholder="Nome"
                    onBlur={(e) => e.target.value !== (p.nome || '') && renomear(p.id, e.target.value)}
                  />
                  <div className="mt-0.5 truncate text-[length:var(--text-label)] text-[var(--color-ink-soft)]">{p.email}</div>
                </div>
                <select className="select w-auto" title="Setor (qual calendário a pessoa enxerga)" value={p.setor ?? 'assistencial'} onChange={(e) => mudarSetor(p.id, e.target.value as Setor)}>
                  {SETORES.map((s) => <option key={s} value={s}>{SETOR_LABEL[s]}</option>)}
                </select>
                <select className="select w-auto" title="Papel" value={p.role} onChange={(e) => mudarPapel(p.id, e.target.value as Papel)}>
                  {(Object.keys(PAPEL_LABEL) as Papel[]).map((r) => <option key={r} value={r}>{PAPEL_LABEL[r]}</option>)}
                </select>
                <button
                  className="btn-ghost text-[var(--color-overdue)]"
                  disabled={p.id === eu?.id}
                  title={p.id === eu?.id ? 'Você não pode excluir o próprio usuário' : 'Excluir'}
                  onClick={() => excluir(p)}
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
