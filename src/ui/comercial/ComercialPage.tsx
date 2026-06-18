import { useMemo, useState } from 'react';
import { useComercial } from '../../comercial/store';
import {
  type Contrato,
  type Edital,
  type FaseEdital,
  FASE_LABEL,
  FASES_FUNIL,
  diasAte,
  editalNovo,
  contratoNovo,
  prazoStatus,
} from '../../comercial/model';
import { todayISO } from '../format';
import { fmtMoeda } from './shared';
import { EditalDetail } from './EditalDetail';
import { ContratoDetail } from './ContratoDetail';

type Secao = 'editais' | 'contratos';
type SubEditais = 'funil' | 'decisao' | 'verificar';
type SubContratos = 'todos' | 'renovacao';

const STATUS_LABEL: Record<Contrato['status'], string> = {
  ativo: 'Ativo',
  inativo: 'Inativo (rodízio)',
  suspenso: 'Suspenso',
  vencido: 'Vencido',
};

export function ComercialPage() {
  const c = useComercial();
  const [secao, setSecao] = useState<Secao>('editais');
  const [subEd, setSubEd] = useState<SubEditais>('funil');
  const [subCt, setSubCt] = useState<SubContratos>('todos');
  const [edital, setEdital] = useState<Edital | null>(null);
  const [contrato, setContrato] = useState<Contrato | null>(null);

  const hoje = todayISO();
  const { editais, contratos, janelaRenovacaoDias } = c.state;

  const aguardando = useMemo(() => editais.filter((e) => e.fase === 'decisao'), [editais]);
  const verificar = useMemo(
    () =>
      editais
        .filter((e) => e.fase === 'enviado')
        .sort((a, b) => (a.proximaVerificacao ?? '9999').localeCompare(b.proximaVerificacao ?? '9999')),
    [editais],
  );
  const renovacao = useMemo(
    () =>
      contratos.filter((ct) => {
        if (ct.status === 'vencido' || !ct.fimVencimento) return false;
        const d = diasAte(ct.fimVencimento, hoje);
        return d <= janelaRenovacaoDias;
      }),
    [contratos, janelaRenovacaoDias, hoje],
  );

  function novoEdital() {
    const e = editalNovo();
    c.upsertEdital(e);
    setEdital(e);
  }
  function novoContrato() {
    const ct = contratoNovo();
    c.upsertContrato(ct);
    setContrato(ct);
  }

  return (
    <div className="space-y-[var(--spacing-20)]">
      {/* Seletor de seção */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented">
          <button className="seg-btn" data-active={secao === 'editais'} onClick={() => setSecao('editais')}>Editais</button>
          <button className="seg-btn" data-active={secao === 'contratos'} onClick={() => setSecao('contratos')}>Contratos</button>
        </div>
        {secao === 'editais' ? (
          <button className="btn-primary ml-auto" onClick={novoEdital}>+ Novo edital</button>
        ) : (
          <button className="btn-primary ml-auto" onClick={novoContrato}>+ Novo contrato</button>
        )}
      </div>

      {secao === 'editais' && (
        <>
          <div className="segmented w-fit">
            <button className="seg-btn" data-active={subEd === 'funil'} onClick={() => setSubEd('funil')}>Funil</button>
            <button className="seg-btn" data-active={subEd === 'decisao'} onClick={() => setSubEd('decisao')}>
              Aguardando decisão{aguardando.length ? ` (${aguardando.length})` : ''}
            </button>
            <button className="seg-btn" data-active={subEd === 'verificar'} onClick={() => setSubEd('verificar')}>
              A verificar{verificar.length ? ` (${verificar.length})` : ''}
            </button>
          </div>

          {subEd === 'funil' && <Funil editais={editais} onOpen={setEdital} hoje={hoje} />}
          {subEd === 'decisao' && (
            <Lista vazio="Nenhum edital aguardando decisão.">
              {aguardando.map((e) => <EditalCard key={e.id} e={e} hoje={hoje} onOpen={setEdital} />)}
            </Lista>
          )}
          {subEd === 'verificar' && (
            <Lista vazio="Nenhum edital enviado em acompanhamento.">
              {verificar.map((e) => <EditalCard key={e.id} e={e} hoje={hoje} onOpen={setEdital} mostrarVerificacao />)}
            </Lista>
          )}
        </>
      )}

      {secao === 'contratos' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="segmented w-fit">
              <button className="seg-btn" data-active={subCt === 'todos'} onClick={() => setSubCt('todos')}>Todos</button>
              <button className="seg-btn" data-active={subCt === 'renovacao'} onClick={() => setSubCt('renovacao')}>
                Renovação à vista{renovacao.length ? ` (${renovacao.length})` : ''}
              </button>
            </div>
            <label className="ml-auto flex items-center gap-2 text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
              Janela de renovação (dias)
              <input
                className="input w-[80px] py-1"
                inputMode="numeric"
                value={janelaRenovacaoDias}
                onChange={(e) => c.setJanela(Number(e.target.value) || 0)}
              />
            </label>
          </div>

          {subCt === 'todos' && (
            <Lista vazio="Nenhum contrato cadastrado.">
              {contratos.map((ct) => <ContratoCard key={ct.id} ct={ct} hoje={hoje} onOpen={setContrato} />)}
            </Lista>
          )}
          {subCt === 'renovacao' && (
            <Lista vazio="Nenhum contrato dentro da janela de renovação.">
              {renovacao.map((ct) => (
                <ContratoCard key={ct.id} ct={ct} hoje={hoje} onOpen={setContrato} acaoRenovar onRenovar={() => c.criarRenovacao(ct)} />
              ))}
            </Lista>
          )}
        </>
      )}

      {edital && <EditalDetail edital={c.state.editais.find((x) => x.id === edital.id) ?? edital} onClose={() => setEdital(null)} />}
      {contrato && <ContratoDetail contrato={c.state.contratos.find((x) => x.id === contrato.id) ?? contrato} onClose={() => setContrato(null)} />}
    </div>
  );
}

function Lista({ children, vazio }: { children: React.ReactNode; vazio: string }) {
  const arr = Array.isArray(children) ? children : [children];
  if (arr.flat().filter(Boolean).length === 0) {
    return <p className="text-[var(--color-ink-soft)]">{vazio}</p>;
  }
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

// Colunas do Kanban: as fases do funil + as terminais.
const COLUNAS_KANBAN: FaseEdital[] = [...FASES_FUNIL, 'ativo', 'perdido', 'descartado'];

// Uma cor por fase (estilo Pipefy).
const FASE_COR: Record<FaseEdital, string> = {
  triagem: '#64748B', // slate
  decisao: '#D97706', // âmbar
  reunir: '#2563EB', // azul
  conferencia: '#7C3AED', // roxo
  correcao: '#EA580C', // laranja
  envio: '#0891B2', // ciano
  enviado: '#0D9488', // teal
  ativo: '#1F9D55', // verde
  perdido: '#D92D20', // vermelho
  descartado: '#94A3B8', // cinza
};

function Funil({ editais, onOpen, hoje }: { editais: Edital[]; onOpen: (e: Edital) => void; hoje: string }) {
  if (editais.length === 0) {
    return <p className="text-[var(--color-ink-soft)]">Nenhum edital no funil. Use “+ Novo edital”.</p>;
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUNAS_KANBAN.map((fase) => {
        const list = editais.filter((e) => e.fase === fase);
        const cor = FASE_COR[fase];
        return (
          <div
            key={fase}
            className="flex min-w-[244px] flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-canvas)]"
          >
            {/* Cabeçalho colorido da fase */}
            <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ backgroundColor: `${cor}14`, borderTop: `3px solid ${cor}` }}>
              <span className="flex items-center gap-2 truncate text-[length:var(--text-caption)] font-semibold uppercase tracking-wide" style={{ color: cor }}>
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                {FASE_LABEL[fase]}
              </span>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[length:var(--text-caption)] font-semibold" style={{ backgroundColor: `${cor}1F`, color: cor }}>
                {list.length}
              </span>
            </div>
            {/* Cards */}
            <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
              {list.map((e) => (
                <EditalCard key={e.id} e={e} hoje={hoje} onOpen={onOpen} cor={cor} />
              ))}
              {list.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] py-6 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">
                  vazio
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditalCard({ e, hoje, onOpen, mostrarVerificacao, cor }: { e: Edital; hoje: string; onOpen: (e: Edital) => void; mostrarVerificacao?: boolean; cor?: string }) {
  const sub = prazoStatus(e.submissaoFim, hoje);
  const venc = mostrarVerificacao && e.proximaVerificacao ? diasAte(e.proximaVerificacao, hoje) : undefined;
  return (
    <button
      className="group w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-rest)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
      style={cor ? { borderLeft: `3px solid ${cor}` } : undefined}
      onClick={() => onOpen(e)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-[var(--color-ink)]">{e.cidade ? `${e.cidade}/${e.uf}` : 'Novo edital'}</span>
        {!cor && <span className="chip shrink-0">{FASE_LABEL[e.fase]}</span>}
      </div>
      {e.tipoServico && <div className="mt-1 line-clamp-2 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">{e.tipoServico}</div>}
      {e.valor != null && <div className="mt-1.5 text-[length:var(--text-caption)] font-medium text-[var(--color-ink)]">{fmtMoeda(e.valor)}</div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sub === 'vencido' && <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Submissão vencida</span>}
        {sub === 'proximo' && <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Submissão próxima</span>}
        {mostrarVerificacao && venc != null && (
          <span className={`chip ${venc <= 0 ? 'border-[var(--color-overdue)] text-[var(--color-overdue)]' : ''}`}>
            {venc < 0 ? `Verificar (atrasado ${-venc}d)` : venc === 0 ? 'Verificar hoje' : `Verificar em ${venc}d`}
          </span>
        )}
      </div>
    </button>
  );
}

function ContratoCard({
  ct,
  hoje,
  onOpen,
  acaoRenovar,
  onRenovar,
}: {
  ct: Contrato;
  hoje: string;
  onOpen: (c: Contrato) => void;
  acaoRenovar?: boolean;
  onRenovar?: () => void;
}) {
  const dias = ct.fimVencimento ? diasAte(ct.fimVencimento, hoje) : undefined;
  return (
    <div className="card p-[var(--spacing-16)]">
      <button className="block w-full text-left" onClick={() => onOpen(ct)}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-[var(--color-ink)]">{ct.cidade ? `${ct.cidade}/${ct.uf}` : 'Novo contrato'}</span>
          <span className="chip shrink-0">{STATUS_LABEL[ct.status]}</span>
        </div>
        <div className="mt-1 text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
          {ct.tipoServico || 'Sem tipo definido'} · {fmtMoeda(ct.valor)}
        </div>
        {dias != null && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dias < 0 ? (
              <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Vencido</span>
            ) : (
              <span className={`chip ${dias <= 90 ? 'border-[var(--color-overdue)] text-[var(--color-overdue)]' : ''}`}>Vence em {dias}d</span>
            )}
          </div>
        )}
      </button>
      {acaoRenovar && (
        <button className="btn-secondary mt-3" onClick={onRenovar}>Criar edital de renovação</button>
      )}
    </div>
  );
}
