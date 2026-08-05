import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { useAuth, type Perfil } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import {
  situacaoDemanda,
  podeVer,
  type Demanda,
  type ObligationEstado,
  type Visibilidade,
} from '../../domain/types';
import { ESTADO_LABEL, estadoChipClass, formatDateShort, todayISO } from '../format';
import { Subtarefas } from './Subtarefas';
import { TudoEmDia } from './TudoEmDia';

const ORDEM_ESTADO: ObligationEstado[] = ['pendente', 'aguardandoInput', 'emAprovacao', 'concluida'];

function novaDemanda(criadoPor?: string): Demanda {
  const hoje = todayISO();
  const fimDoMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  return {
    id: `dem-${crypto.randomUUID().slice(0, 8)}`,
    titulo: '',
    inicio: hoje,
    prazo: fimDoMes,
    estado: 'pendente',
    criadoPor,
    criadoEm: new Date().toISOString(),
    visibilidade: 'setor',
  };
}

/**
 * Demandas: trabalho repassado, em andamento, sem data fixa de execução — só um
 * período (de … até) com prazo máximo de entrega. Serve para acompanhar o que
 * está em aberto e o que já foi entregue.
 */
export function DemandasPage() {
  const store = useStore();
  const { perfil, isGestor } = useAuth();
  const [editando, setEditando] = useState<Demanda | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const hoje = todayISO();

  // Só o que este usuário pode ver. O banco já filtra (RLS); aqui é para a tela
  // não contar/mostrar algo que o servidor recusaria.
  const visiveis = useMemo(
    () => store.state.demandas.filter((d) => podeVer(d, perfil?.id, isGestor)),
    [store.state.demandas, perfil?.id, isGestor],
  );

  const abertas = visiveis
    .filter((d) => d.estado !== 'concluida')
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  const concluidas = visiveis.filter((d) => d.estado === 'concluida');
  const atrasadas = abertas.filter((d) => situacaoDemanda(d, hoje).atrasada).length;

  return (
    <div className="mx-auto max-w-[860px] space-y-[var(--spacing-16)]">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
            Trabalho em andamento sem data fixa: você define um período e acompanha até a entrega.
          </p>
          {abertas.length > 0 && (
            <p className="label mt-1">
              {abertas.length} em aberto
              {atrasadas > 0 && (
                <span className="font-semibold text-[var(--color-overdue)]"> · {atrasadas} passou do prazo</span>
              )}
            </p>
          )}
        </div>
        <button className="btn-primary ml-auto" onClick={() => setEditando(novaDemanda(perfil?.id))}>
          + Nova demanda
        </button>
      </div>

      {abertas.length === 0 ? (
        <TudoEmDia texto="Nenhuma demanda em aberto." />
      ) : (
        <div className="list-stack">
          {abertas.map((d) => (
            <LinhaDemanda key={d.id} d={d} hoje={hoje} onAbrir={() => setEditando({ ...d })} />
          ))}
        </div>
      )}

      {concluidas.length > 0 && (
        <div>
          <button className="btn-ghost inline-flex items-center gap-1.5" onClick={() => setVerConcluidas((v) => !v)}>
            Entregues ({concluidas.length})
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${verConcluidas ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {verConcluidas && (
            <div className="list-stack mt-2">
              {concluidas.map((d) => (
                <LinhaDemanda key={d.id} d={d} hoje={hoje} onAbrir={() => setEditando({ ...d })} />
              ))}
            </div>
          )}
        </div>
      )}

      {editando && (
        <DemandaForm
          demanda={editando}
          onClose={() => setEditando(null)}
          onSalvar={(d) => {
            store.upsertDemanda(d);
            setEditando(null);
          }}
          onExcluir={
            store.state.demandas.some((x) => x.id === editando.id)
              ? () => {
                  store.removeDemanda(editando.id);
                  setEditando(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function LinhaDemanda({ d, hoje, onAbrir }: { d: Demanda; hoje: string; onAbrir: () => void }) {
  const s = situacaoDemanda(d, hoje);
  const etapas = d.subtarefas ?? [];
  const feitas = etapas.filter((x) => x.feita).length;

  const prazoTexto = s.concluida
    ? `entregue${d.concluidaEm ? ` em ${formatDateShort(d.concluidaEm.slice(0, 10))}` : ''}`
    : s.atrasada
      ? `${Math.abs(s.diasRestantes)} dia(s) de atraso`
      : s.diasRestantes === 0
        ? 'vence hoje'
        : `faltam ${s.diasRestantes} dia(s)`;

  return (
    <div className="obl-row" data-urgencia={s.concluida ? 'done' : s.atrasada ? 'atrasada' : 'normal'}>
      <div className="flex flex-wrap items-start gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={onAbrir}>
          <div className={`text-[length:var(--text-body)] ${s.concluida ? 'text-[var(--color-ink-soft)] line-through' : 'font-medium text-[var(--color-ink)]'}`}>
            {d.titulo || 'Sem título'}
          </div>
          <div className="label mt-0.5 flex flex-wrap gap-x-2">
            <span>
              {formatDateShort(d.inicio)} → {formatDateShort(d.prazo)}
            </span>
            <span className={s.atrasada ? 'font-semibold text-[var(--color-overdue)]' : ''}>· {prazoTexto}</span>
            {d.responsavel && <span>· {d.responsavel}</span>}
            {etapas.length > 0 && <span className="text-[var(--color-ink)]">· {feitas} de {etapas.length} etapas</span>}
            {d.visibilidade === 'restrita' && <span title="Visível só para quem foi autorizado">· restrita</span>}
          </div>
        </button>
        <span className={estadoChipClass(d.estado)}>{ESTADO_LABEL[d.estado]}</span>
      </div>
    </div>
  );
}

function DemandaForm({
  demanda,
  onSalvar,
  onClose,
  onExcluir,
}: {
  demanda: Demanda;
  onSalvar: (d: Demanda) => void;
  onClose: () => void;
  onExcluir?: () => void;
}) {
  const store = useStore();
  const { perfil, isGestor } = useAuth();
  const [d, setD] = useState<Demanda>(demanda);
  const [pessoas, setPessoas] = useState<Perfil[]>([]);
  const set = <K extends keyof Demanda>(k: K, v: Demanda[K]) => setD((x) => ({ ...x, [k]: v }));

  // Quem pode ser autorizado: as pessoas do próprio setor (o RLS de profiles
  // já limita a lista ao setor de quem consulta).
  useEffect(() => {
    let vivo = true;
    void supabase
      .from('profiles')
      .select('*')
      .order('nome')
      .then(({ data }) => {
        if (vivo) setPessoas((data ?? []) as Perfil[]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const restrita = (d.visibilidade ?? 'setor') === 'restrita';
  const permitidos = d.permitidos ?? [];
  const togglePessoa = (id: string) =>
    set('permitidos', permitidos.includes(id) ? permitidos.filter((x) => x !== id) : [...permitidos, id]);

  function salvar() {
    const virouConcluida = d.estado === 'concluida' && demanda.estado !== 'concluida';
    onSalvar({
      ...d,
      titulo: d.titulo.trim(),
      criadoPor: d.criadoPor ?? perfil?.id,
      concluidaEm: virouConcluida ? new Date().toISOString() : d.estado === 'concluida' ? d.concluidaEm : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="drawer h-full w-full max-w-[480px] space-y-3 overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-24)] shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[length:var(--text-heading)]">{demanda.titulo ? 'Editar demanda' : 'Nova demanda'}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <Campo label="O que foi pedido">
          <input className="input" autoFocus value={d.titulo} onChange={(e) => set('titulo', e.target.value)} />
        </Campo>
        <Campo label="Detalhes (opcional)">
          <textarea className="input" rows={3} value={d.descricao ?? ''} onChange={(e) => set('descricao', e.target.value || undefined)} />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="De">
            <input className="input" type="date" value={d.inicio} onChange={(e) => set('inicio', e.target.value)} />
          </Campo>
          <Campo label="Até (prazo máximo)">
            <input className="input" type="date" value={d.prazo} onChange={(e) => set('prazo', e.target.value)} />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Responsável">
            <input className="input" value={d.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value || undefined)} />
          </Campo>
          <Campo label="Situação">
            <select className="select" value={d.estado} onChange={(e) => set('estado', e.target.value as ObligationEstado)}>
              {ORDEM_ESTADO.map((s) => (
                <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo label="Projeto (opcional)">
          <select className="select" value={d.projetoId ?? ''} onChange={(e) => set('projetoId', e.target.value || undefined)}>
            <option value="">—</option>
            {store.state.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </Campo>

        {/* Quem enxerga */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
          <Campo label="Quem pode ver">
            <select
              className="select"
              value={d.visibilidade ?? 'setor'}
              onChange={(e) => set('visibilidade', e.target.value as Visibilidade)}
            >
              <option value="setor">Todo o setor</option>
              <option value="restrita">Somente as pessoas que eu escolher</option>
            </select>
          </Campo>
          {restrita && (
            <div className="mt-3">
              <span className="label mb-1 block">Pessoas autorizadas</span>
              <div className="space-y-1">
                {pessoas
                  .filter((p) => p.id !== (d.criadoPor ?? perfil?.id))
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-[length:var(--text-label)]">
                      <input type="checkbox" checked={permitidos.includes(p.id)} onChange={() => togglePessoa(p.id)} />
                      <span className="min-w-0 truncate">{p.nome || p.email}</span>
                    </label>
                  ))}
                {pessoas.length <= 1 && <p className="label">Nenhuma outra pessoa no setor ainda.</p>}
              </div>
              <p className="label mt-2">
                Quem criou sempre enxerga. O gestor do setor também — ele responde pela área.
              </p>
            </div>
          )}
          {!restrita && (
            <p className="label mt-2">Todo mundo do seu setor enxerga esta demanda.</p>
          )}
        </div>

        <div className="border-t border-[var(--color-line)] pt-3">
          <Subtarefas valor={d.subtarefas} onChange={(sub) => set('subtarefas', sub)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button className="btn-primary" disabled={!d.titulo.trim() || !d.prazo} onClick={salvar}>
            Salvar
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          {onExcluir && (
            <button className="btn-ghost ml-auto text-[var(--color-overdue)]" onClick={onExcluir}>
              Excluir
            </button>
          )}
        </div>
        {!isGestor && d.criadoPor && d.criadoPor !== perfil?.id && (
          <p className="label">Esta demanda foi criada por outra pessoa.</p>
        )}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block uppercase">{label}</span>
      {children}
    </label>
  );
}
