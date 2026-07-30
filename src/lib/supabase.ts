import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente único do Supabase. URL e anon key vêm das variáveis de ambiente
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), definidas no .env local e no
// Render. A anon key é pública por design — a segurança real vem do RLS.
// Limpa espaços e aspas acidentais (erro comum ao colar no painel).
function limpar(v: string | undefined): string {
  return (v ?? '').trim().replace(/^["']|["']$/g, '');
}

const url = limpar(import.meta.env.VITE_SUPABASE_URL);
const anonKey = limpar(import.meta.env.VITE_SUPABASE_ANON_KEY);

/** Indica se o app foi configurado com credenciais do Supabase. */
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // Não derruba o build; apenas avisa. A UI mostra um aviso de configuração.
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não definidas. ' +
      'Defina-as no .env (local) e no Render (Environment).',
  );
}

/**
 * Trava de acesso ao token SEM o Web Locks API (`navigator.locks`).
 *
 * O supabase-js usa `navigator.locks` para coordenar a renovação do token entre
 * abas. Na prática, uma trava órfã (aba fechada no meio de um refresh, guia
 * duplicada, navegador restaurando sessão) faz `getSession()` **nunca resolver**
 * — e o app fica preso no "Carregando…" para sempre, sem erro nenhum.
 *
 * Aqui serializamos as chamadas numa fila em memória: mesma garantia dentro da
 * aba, sem a trava entre abas que pode emperrar. O pior caso vira uma renovação
 * de token repetida entre abas (inofensiva), em vez de um app travado.
 */
let fila: Promise<unknown> = Promise.resolve();
function travaLocal<R>(_nome: string, _timeout: number, fn: () => Promise<R>): Promise<R> {
  const proxima = fila.then(fn, fn);
  fila = proxima.catch(() => {});
  return proxima;
}

export const supabase: SupabaseClient = createClient(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: travaLocal,
    },
  },
);

/** Nome do bucket de Storage usado para anexos reais. */
export const STORAGE_BUCKET = 'anexos';
