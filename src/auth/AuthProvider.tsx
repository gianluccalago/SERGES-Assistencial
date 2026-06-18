import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

export type Papel = 'gestor' | 'equipe';

export interface Perfil {
  id: string;
  email: string;
  nome: string | null;
  role: Papel;
}

interface AuthApi {
  session: Session | null;
  perfil: Perfil | null;
  loading: boolean;
  isGestor: boolean;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregarPerfil(userId: string, email: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setPerfil({ id: data.id, email: data.email ?? email, nome: data.nome ?? null, role: (data.role as Papel) ?? 'equipe' });
    } else {
      // Sem perfil cadastrado: trata como equipe (sem ações de gestor) até ser provisionado.
      setPerfil({ id: userId, email, nome: null, role: 'equipe' });
    }
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await carregarPerfil(data.session.user.id, data.session.user.email ?? '');
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s?.user) await carregarPerfil(s.user.id, s.user.email ?? '');
      else setPerfil(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      session,
      perfil,
      loading,
      isGestor: perfil?.role === 'gestor',
      async signIn(email, senha) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        return { error: error ? traduzErro(error.message) : null };
      },
      async signOut() {
        await supabase.auth.signOut();
        setPerfil(null);
      },
    }),
    [session, perfil, loading],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha inválidos.';
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.';
  return msg;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

/** Atalho para gating de UI: props padrão para um controle exclusivo do gestor. */
export function useGestorGate() {
  const { isGestor } = useAuth();
  return {
    isGestor,
    /** Aplique em botões/ações exclusivos do gestor. */
    gestorProps: isGestor
      ? {}
      : { disabled: true, title: 'Ação exclusiva do gestor', 'aria-disabled': true as const },
  };
}
