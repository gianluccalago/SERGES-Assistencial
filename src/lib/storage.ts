import { supabase, STORAGE_BUCKET } from './supabase';

// Upload de arquivos reais para o Supabase Storage. Guardamos apenas a
// referência (caminho + nome) no banco — nunca o binário. Abrir/baixar usam
// URL assinada de curta duração.

/** Teto de tamanho por arquivo (MB). */
export const MAX_MB = 25;

const SAFE = /[^a-zA-Z0-9._-]+/g;

export interface UploadResult {
  path: string;
  nome: string;
}

/** Faz upload de um arquivo sob um prefixo (ex.: "editais/<id>/gerais"). */
export async function uploadArquivo(prefixo: string, file: File): Promise<UploadResult> {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`Arquivo acima de ${MAX_MB} MB. Use um link externo (SharePoint/portal) para arquivos grandes.`);
  }
  const limpo = file.name.replace(SAFE, '_');
  const path = `${prefixo}/${crypto.randomUUID().slice(0, 8)}-${limpo}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, nome: file.name };
}

/** Gera uma URL assinada (60 min) para abrir/baixar. */
export async function urlAssinada(path: string, download = false): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 3600, download ? { download: true } : undefined);
  if (error) return null;
  return data.signedUrl;
}

/** Remove um arquivo do Storage (best-effort). */
export async function removerArquivo(path: string): Promise<void> {
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

/** Abre um arquivo do Storage numa nova aba via URL assinada. */
export async function abrirArquivo(path: string, download = false): Promise<void> {
  const url = await urlAssinada(path, download);
  if (url) window.open(url, '_blank', 'noopener');
}
