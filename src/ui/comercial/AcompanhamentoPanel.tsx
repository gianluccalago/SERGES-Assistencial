import { useMemo, useState } from 'react';
import { useComercial } from '../../comercial/store';
import {
  type Edital,
  type Periodicidade,
  PERIODICIDADE_LABEL,
  avancaVerificacao,
  diasAte,
} from '../../comercial/model';
import { todayISO } from '../format';
import { fmtMoeda } from './shared';

// Aba dedicada ao acompanhamento seriado das licitações enviadas.
// Lista todos os editais em "Enviado", ordenados pela próxima verificação,
// destacando hoje/atrasados. Todo o acompanhamento é feito por aqui.
export function AcompanhamentoPanel({ onAbrirFicha }: { onAbrirFicha: (e: Edital) => void }) {
  const c = useComercial();
  const hoje = todayISO();

  const lista = useMemo(
    () =>
      c.state.editais
        .filter((e) => e.fase === 'enviado')
        .sort((a, b) => (a.proximaVerificacao ?? '9999').localeCompare(b.proximaVerificacao ?? '9999')),
    [c.state.editais],
  );

  if (lista.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-ink-soft)]">
        Nenhuma licitação enviada em acompanhamento.
        <div className="label mt-1">Quando uma licitação for marcada como “Enviado” no funil, ela aparece aqui.</div>
      </div>
    );
  }

  const aVerificar = lista.filter((e) => e.proximaVerificacao && diasAte(e.proximaVerificacao, hoje) <= 0).length;

  return (
    <div className="space-y-[var(--spacing-16)]">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-ink-soft)]">
        <span className="text-[length:var(--text-label)]">
          {lista.length} licitação(ões) em acompanhamento
        </span>
        {aVerificar > 0 && (
          <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">{aVerificar} para verificar hoje/atrasadas</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {lista.map((e) => (
          <CardAcompanhamento key={e.id} e={e} hoje={hoje} onPatch={(p) => c.upsertEdital({ ...e, ...p })} onGanhar={() => c.ganharEdital(e)} onAbrirFicha={() => onAbrirFicha(e)} />
        ))}
      </div>
    </div>
  );
}

function CardAcompanhamento({
  e,
  hoje,
  onPatch,
  onGanhar,
  onAbrirFicha,
}: {
  e: Edital;
  hoje: string;
  onPatch: (p: Partial<Edital>) => void;
  onGanhar: () => void;
  onAbrirFicha: () => void;
}) {
  const [obs, setObs] = useState('');
  const [verHistorico, setVerHistorico] = useState(false);

  const dias = e.proximaVerificacao ? diasAte(e.proximaVerificacao, hoje) : undefined;
  const atrasado = dias != null && dias < 0;
  const hojeMarcado = dias === 0;
  const urgente = atrasado || hojeMarcado;
  const cor = urgente ? 'var(--color-overdue)' : '#2DD4BF';

  // Sugere verificação diária quando o resultado previsto está próximo (≤7 dias).
  const prevDias = e.dataPrevistaResultado ? diasAte(e.dataPrevistaResultado, hoje) : undefined;
  const sugereDiaria = prevDias != null && prevDias >= 0 && prevDias <= 7;

  function registrar() {
    const per = e.periodicidade ?? 'semanal';
    onPatch({
      verificacoes: [...e.verificacoes, { id: `v-${Math.random().toString(36).slice(2, 7)}`, data: hoje, obs: obs.trim() || 'Sem resultado ainda' }],
      proximaVerificacao: avancaVerificacao(hoje, per),
      periodicidade: per,
    });
    setObs('');
  }

  return (
    <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-16)] shadow-[var(--shadow-rest)]" style={{ borderLeft: `3px solid ${cor}` }}>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <button className="min-w-0 text-left" onClick={onAbrirFicha} title="Abrir ficha completa">
          <div className="truncate font-semibold text-[var(--color-ink)] hover:underline">{e.titulo || (e.cidade ? `${e.cidade}/${e.uf}` : 'Licitação')}</div>
          {(e.titulo && e.cidade) && <div className="text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">{e.cidade}/{e.uf}</div>}
        </button>
        <span className="chip shrink-0" style={{ borderColor: cor, color: cor }}>
          {dias == null ? 'Sem data' : atrasado ? `Atrasado ${-dias}d` : hojeMarcado ? 'Verificar hoje' : `Em ${dias}d`}
        </span>
      </div>
      {e.valor != null && <div className="mt-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">{fmtMoeda(e.valor)}</div>}

      {/* Portal */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {e.urlAcompanhamento ? (
          <a className="btn-primary" href={e.urlAcompanhamento} target="_blank" rel="noreferrer">Abrir portal ↗</a>
        ) : (
          <input
            className="input flex-1"
            placeholder="Colar URL de acompanhamento (portal)"
            value={e.urlAcompanhamento ?? ''}
            onChange={(ev) => onPatch({ urlAcompanhamento: ev.target.value })}
          />
        )}
        {e.urlAcompanhamento && (
          <button className="btn-ghost" onClick={() => onPatch({ urlAcompanhamento: '' })} title="Trocar URL">editar URL</button>
        )}
      </div>

      {/* Config */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label mb-1 block">Periodicidade</span>
          <select className="select" value={e.periodicidade ?? 'semanal'} onChange={(ev) => onPatch({ periodicidade: ev.target.value as Periodicidade })}>
            {(Object.keys(PERIODICIDADE_LABEL) as Periodicidade[]).map((p) => <option key={p} value={p}>{PERIODICIDADE_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label mb-1 block">Resultado previsto</span>
          <input className="input" type="date" value={e.dataPrevistaResultado ?? ''} onChange={(ev) => onPatch({ dataPrevistaResultado: ev.target.value })} />
        </label>
      </div>
      {sugereDiaria && (
        <p className="label mt-2 text-[var(--color-overdue)]">Resultado previsto em {prevDias === 0 ? 'hoje' : `${prevDias}d`} — sugerimos verificar diariamente.</p>
      )}

      {/* Registrar verificação */}
      <div className="mt-3">
        <span className="label mb-1 block">Registrar verificação</span>
        <textarea className="input" rows={2} placeholder="Ex.: sem resultado ainda; habilitados publicados; resultado previsto para…" value={obs} onChange={(ev) => setObs(ev.target.value)} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button className="btn-primary" onClick={registrar}>Registrar verificação</button>
          <span className="label">Próxima: {e.proximaVerificacao ?? '—'}</span>
        </div>
      </div>

      {/* Histórico */}
      {e.verificacoes.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-line)] pt-2">
          <button className="label flex items-center gap-1" onClick={() => setVerHistorico((v) => !v)}>
            Histórico ({e.verificacoes.length}) {verHistorico ? '▲' : '▼'}
          </button>
          {verHistorico && (
            <div className="mt-1 space-y-1 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
              {[...e.verificacoes].reverse().map((v) => (
                <div key={v.id}><span className="font-medium text-[var(--color-ink)]">{v.data}</span> — {v.obs}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resultado */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-3">
        <button className="btn-secondary" style={{ color: 'var(--color-done)' }} onClick={onGanhar}>Ganhamos → Ativos</button>
        <button className="btn-ghost" onClick={onAbrirFicha}>Perdido / mais opções</button>
      </div>
    </div>
  );
}
