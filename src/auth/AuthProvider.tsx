import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';
import type { Setor } from '../domain/types';

export type Papel = 'gestor' | 'equipe';

export interface Perfil {
  id: string;
  email: string;
  nome: string | null;
  role: Papel;
  /** Setor dono dos dados que este usuário enxerga. */
  setor: Setor;
}

interface AuthApi {
  session: Session | null;
  perfil: Perfil | null;
  loading: boolean;
  isGestor: boolean;
  /** Setor do usuário logado (assistencial enquanto o perfil não carregou). */
  setor: Setor;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

/** Resolve com `fallback` se a promessa demorar demais ou falhar (nunca rejeita). */
async function comTeto<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([Promise.resolve(p).catch(() => fallback), limite]);
  } finally {
    clearTimeout(timer);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  /** Usuário cujo perfil já foi buscado — evita refetch a cada renovação de token. */
  const perfilDeRef = useRef<string | null>(null);

  async function carregarPerfil(userId: string, email: string) {
    if (perfilDeRef.current === userId) return;
    perfilDeRef.current = userId;
    // Consulta com teto de tempo: nada aqui pode segurar a tela.
    const consulta = (async () => {
      const r = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      return { data: r.data as Record<string, unknown> | null };
    })();
    const { data } = await comTeto(consulta, 6000, { data: null });
    if (data) {
      setPerfil({
        id: String(data.id),
        email: (data.email as string) ?? email,
        nome: (data.nome as string) ?? null,
        role: (data.role as Papel) ?? 'equipe',
        setor: (data.setor as Setor) ?? 'assistencial',
      });
    } else {
      // Sem perfil cadastrado: trata como equipe (sem ações de gestor) até ser provisionado.
      setPerfil({ id: userId, email, nome: null, role: 'equipe', setor: 'assistencial' });
    }
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1) O ouvinte vem PRIMEIRO: ele dispara INITIAL_SESSION assim que o cliente
    //    lê o token do localStorage — costuma chegar antes do getSession().
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      if (s?.user) void carregarPerfil(s.user.id, s.user.email ?? '');
      else {
        perfilDeRef.current = null;
        setPerfil(null);
      }
    });

    // 2) getSession com teto próprio. Se estourar, seguimos com o que o ouvinte
    //    trouxer — nunca ficamos esperando para sempre.
    void (async () => {
      const consulta = (async () => (await supabase.auth.getSession()).data.session)();
      const sessao = await comTeto<Session | null>(consulta, 5000, null);
      setSession((atual) => atual ?? sessao);
      if (sessao?.user) void carregarPerfil(sessao.user.id, sessao.user.email ?? '');
      setLoading(false);
    })();

    // 3) Rede de segurança final: aconteça o que acontecer, a tela destrava.
    //    (Sem sessão, cai no login — melhor que um "Carregando…" eterno.)
    const destravar = setTimeout(() => setLoading(false), 6000);
    return () => {
      clearTimeout(destravar);
      sub.subscription.unsubscribe();
    };
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      session,
      perfil,
      loading,
      isGestor: perfil?.role === 'gestor',
      setor: perfil?.setor ?? 'assistencial',
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
