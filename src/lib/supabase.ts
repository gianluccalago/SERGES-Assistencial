import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente único do Supabase. URL e anon key vêm das variáveis de ambiente
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), definidas no .env local e no
// Render. A anon key é pública por design — a segurança real vem do RLS.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Indica se o app foi configurado com credenciais do Supabase. */
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // Não derruba o build; apenas avisa. A UI mostra um aviso de configuração.
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não definidas. ' +
      'Defina-as no .env (local) e no Render (Environment).',
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  },
);

/** Nome do bucket de Storage usado para anexos reais. */
export const STORAGE_BUCKET = 'anexos';
