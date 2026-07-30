import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { LoginScreen } from '../ui/components/LoginScreen';
import { supabaseConfigured } from '../lib/supabase';

/**
 * Tela de carga com saída de emergência: se passar de 5s, oferece recarregar ou
 * limpar a sessão. Ninguém fica encarando um "Carregando…" sem ter o que fazer.
 */
function Carregando() {
  const [demorou, setDemorou] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDemorou(true), 5000);
    return () => clearTimeout(t);
  }, []);

  function limparSessao() {
    try {
      // Token corrompido é a causa clássica de travar aqui: limpa e recomeça.
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* armazenamento indisponível: segue para o reload mesmo assim */
    }
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="skeleton h-9 w-32 rounded-[var(--radius-md)]" />
      <p className="label">Carregando…</p>
      {demorou && (
        <div className="mt-2 max-w-[360px]">
          <p className="text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
            Está demorando mais que o normal.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button className="btn-secondary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button className="btn-secondary" onClick={limparSessao}>
              Entrar de novo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Exige autenticação antes de renderizar o app (e carregar qualquer dado). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="card max-w-[440px] p-[var(--spacing-24)]">
          <p className="mb-2 font-medium">Supabase não configurado</p>
          <p className="text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
            Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code> (local) e no Render
            (Environment), depois recarregue.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <Carregando />;

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}
