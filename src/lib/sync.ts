import { supabase } from './supabase';

// Motor de sincronização genérico, baseado em diff. Mantém o formato do estado
// em memória idêntico ao anterior (localStorage): as ações das stores não mudam.
// A cada alteração do estado, calculamos o que mudou por coleção e gravamos no
// Supabase (upsert/delete). Realtime recarrega o estado quando outro usuário
// altera algo. Assim preservamos a UX otimista e ganhamos persistência + multi-usuário.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Descreve uma coleção do estado mapeada para uma tabela do Postgres. */
export interface Slice<S> {
  /** Nome da tabela. */
  table: string;
  /** Coluna de chave primária (default: 'id'). */
  pk?: string;
  /** Extrai as linhas atuais do estado: chave estável + linha completa do banco. */
  extract: (state: S) => Array<{ key: string; row: Record<string, unknown> }>;
  /** Reconstrói a fatia do estado a partir das linhas vindas do banco. */
  apply: (base: S, rows: Record<string, unknown>[]) => S;
}

export class Syncer<S> {
  private slices: Slice<S>[];
  private base: () => S;
  /** Última versão persistida por tabela: chave -> JSON da linha. */
  private snapshot = new Map<string, Map<string, string>>();
  /** Fila serial de gravações, para nunca perder a última alteração. */
  private chain: Promise<void> = Promise.resolve();

  constructor(slices: Slice<S>[], base: () => S) {
    this.slices = slices;
    this.base = base;
    for (const s of slices) this.snapshot.set(s.table, new Map());
  }

  private pkOf(s: Slice<S>) {
    return s.pk ?? 'id';
  }

  /** Carrega o estado inteiro do banco. Retorna também se havia alguma linha. */
  async load(): Promise<{ state: S; hadRows: boolean }> {
    let state = this.base();
    let hadRows = false;
    // Consulta todas as tabelas EM PARALELO (não em série) — corta o tempo de
    // carga de "soma das idas e voltas" para "a mais lenta".
    const results = await Promise.all(
      this.slices.map(async (s) => {
        const pk = this.pkOf(s);
        const { data, error } = await supabase.from(s.table).select('*').order(pk);
        return { s, pk, data, error };
      }),
    );
    for (const { s, data, error } of results) {
      if (error) {
        // Uma tabela ausente/indisponível não pode derrubar o carregamento das
        // demais (ex.: tabela nova ainda não criada no banco). Ignora esta fatia.
        console.warn(`[sync] tabela "${s.table}" indisponível, ignorando:`, error.message);
        continue;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      if (rows.length) hadRows = true;
      state = s.apply(state, rows);
    }
    // Snapshot no MESMO formato do extract() (sem updated_at e afins). O push
    // compara contra extract(); se o snapshot guardasse a linha crua do banco
    // (com updated_at), TODA linha "diferiria" e o cliente reescreveria tudo no
    // primeiro push — inclusive tabelas só-gestor (projects/holidays/tarefas_fixas),
    // o que faz a equipe receber "Erro ao salvar". Assim o 1º push é no-op real.
    for (const s of this.slices) {
      const snap = this.snapshot.get(s.table)!;
      snap.clear();
      for (const { key, row } of s.extract(state)) snap.set(key, JSON.stringify(row));
    }
    return { state, hadRows };
  }

  /** Calcula o diff do estado contra o snapshot e grava as mudanças (serial). */
  push(state: S, onStatus?: (st: SaveStatus) => void): Promise<void> {
    const next = this.chain.then(() => this.doPush(state, onStatus));
    // Mantém a cadeia viva mesmo se um push falhar.
    this.chain = next.catch(() => {});
    return next;
  }

  private async doPush(state: S, onStatus?: (st: SaveStatus) => void): Promise<void> {
    let touched = false;
    try {
      for (const s of this.slices) {
        const pk = this.pkOf(s);
        const snap = this.snapshot.get(s.table)!;
        const current = s.extract(state);
        const seen = new Set<string>();
        const upserts: Record<string, unknown>[] = [];
        for (const { key, row } of current) {
          seen.add(key);
          const json = JSON.stringify(row);
          if (snap.get(key) !== json) {
            upserts.push(row);
          }
        }
        const deletes: string[] = [];
        for (const key of snap.keys()) if (!seen.has(key)) deletes.push(key);

        if (upserts.length) {
          if (!touched) {
            touched = true;
            onStatus?.('saving');
          }
          const { error } = await supabase.from(s.table).upsert(upserts);
          if (error) throw error;
          for (const { key, row } of current) snap.set(key, JSON.stringify(row));
        }
        if (deletes.length) {
          if (!touched) {
            touched = true;
            onStatus?.('saving');
          }
          const { error } = await supabase.from(s.table).delete().in(pk, deletes);
          if (error) throw error;
          for (const key of deletes) snap.delete(key);
        }
      }
      if (touched) onStatus?.('saved');
    } catch (e) {
      console.error('[sync] falha ao gravar', e);
      onStatus?.('error');
      throw e;
    }
  }

  /** Assina realtime em todas as tabelas; chama onChange (debounced) ao mudar. */
  subscribe(onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 400);
    };
    const channel = supabase.channel(`serges-sync-${Math.random().toString(36).slice(2, 8)}`);
    for (const s of this.slices) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: s.table }, fire);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }
}
