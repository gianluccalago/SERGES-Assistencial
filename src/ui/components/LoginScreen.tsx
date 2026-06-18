import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { SergesLogo } from './Logo';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await signIn(email, senha);
    setEnviando(false);
    if (error) setErro(error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] p-4">
      <form onSubmit={entrar} className="card w-full max-w-[380px] p-[var(--spacing-24)]">
        <div className="mb-6 flex justify-center">
          <SergesLogo />
        </div>
        <h1 className="mb-1 text-center text-[length:var(--text-subheading)]">Calendário de Obrigações</h1>
        <p className="mb-5 text-center text-[length:var(--text-label)] text-[var(--color-ink-soft)]">Acesso restrito à equipe SERGES</p>

        <label className="mb-3 block">
          <span className="label mb-1 block">E-mail</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="mb-4 block">
          <span className="label mb-1 block">Senha</span>
          <input className="input" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>

        {erro && <p className="mb-3 text-[length:var(--text-label)] text-[var(--color-overdue)]">{erro}</p>}

        <button className="btn-primary w-full justify-center" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="label mt-4 text-center">Usuários são provisionados internamente. Sem cadastro público.</p>
      </form>
    </div>
  );
}
