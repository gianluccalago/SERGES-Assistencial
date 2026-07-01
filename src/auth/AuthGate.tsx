import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { LoginScreen } from '../ui/components/LoginScreen';
import { supabaseConfigured } from '../lib/supabase';

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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="skeleton h-9 w-32 rounded-[var(--radius-md)]" />
        <p className="label">Carregando…</p>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}
