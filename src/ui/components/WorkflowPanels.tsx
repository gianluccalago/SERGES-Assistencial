import { useState } from 'react';
import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import type { Override } from '../../domain/types';
import {
  ASF_FLOW,
  ASF_LABEL,
  asfNext,
  asfPrev,
  asfAprovado,
  notasFracionadas,
  maxDuasCasas,
  cardDevolucaoContratoSocial,
} from '../../domain/workflows';
import { todayISO } from '../format';

// Painéis contextuais das extensões de workflow (§11). Só para obrigações
// geradas (não manuais), com base no id/tipo. Gravam no override.
export function WorkflowPanels({ ro }: { ro: ResolvedObligation }) {
  const store = useStore();
  const { item } = ro;
  if (item.isManual) return null;

  const ov: Override | undefined = store.getOverride(item.id);
  const set = (patch: Partial<Override>) => store.patchOverride(item.id, patch);
  const projeto = item.projetoId ? store.state.projects.find((p) => p.id === item.projetoId) : undefined;

  const isLote = item.tipo === 'lotePagamento';
  const isAsfFat = item.id.startsWith('faturamentoIniciar:asf:');
  const is0600 = item.id.startsWith('fixa:finalizar0600:');
  const isDoc = item.id.startsWith('fixa:documentacao:');
  const isContrSocial = item.id.startsWith('fixa:contratoSocialContabilidade:');
  const isFechamento = item.tipo === 'fechamento';

  return (
    <>
      {isLote && projeto?.contratoSocialObrigatorio && <ContratoSocialAviso />}
      {isLote && projeto?.tetoNota && <NotasFracionadas tetoNota={projeto.tetoNota} />}
      {isAsfFat && <AsfWorkflow ov={ov} set={set} />}
      {is0600 && <Checklist0600 ov={ov} set={set} />}
      {isDoc && <ZapSign ov={ov} set={set} />}
      {isContrSocial && <ContratoSocial ov={ov} set={set} projetoId={item.projetoId} />}
      {isFechamento && <FopamChecklist ov={ov} set={set} />}
    </>
  );
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card mt-[var(--spacing-16)] p-[var(--spacing-16)]">
      <div className="label mb-2 uppercase">{titulo}</div>
      {children}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 py-1 text-[length:var(--text-label)]">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-serges-blue)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// Aviso (não bloqueia) de contrato social no lote de pagamento.
function ContratoSocialAviso() {
  return (
    <div className="mt-[var(--spacing-16)] flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[rgba(255,112,97,0.4)] bg-[var(--color-overdue-tint)] p-[var(--spacing-16)] text-[length:var(--text-label)] text-[color-mix(in_srgb,var(--color-overdue)_80%,white_20%)]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
      </svg>
      <span>Projeto exige contrato social · nota fiscal não permitida · risco de quarteirização.</span>
    </div>
  );
}

// §11.5 — apoio a notas fracionadas (Ipiranga, Herval)
function NotasFracionadas({ tetoNota }: { tetoNota: number }) {
  const [total, setTotal] = useState('');
  const frac = Number(total) > 0 ? notasFracionadas(Number(total), tetoNota) : null;
  return (
    <Panel titulo="Notas fracionadas">
      <div className="label mb-1">Teto R$ {tetoNota.toLocaleString('pt-BR')}/nota</div>
      <input className="input" inputMode="decimal" placeholder="Valor total a faturar" value={total} onChange={(e) => setTotal(e.target.value)} />
      {frac && frac.quantidade > 0 && (
        <p className="label mt-1">
          Dividir em <strong className="text-[var(--color-ink)]">{frac.quantidade}</strong> nota(s) de ~R$ {frac.valorPorNota.toLocaleString('pt-BR')}.
        </p>
      )}
    </Panel>
  );
}

// §11.3 — sub-workflow da ASF
function AsfWorkflow({ ov, set }: { ov?: Override; set: (p: Partial<Override>) => void }) {
  const atual = ov?.asfSubEstado;
  const transicoes = ov?.asfTransicoes ?? [];
  function go(to: ReturnType<typeof asfNext>) {
    if (!to) return;
    set({ asfSubEstado: to, asfTransicoes: [...transicoes, { estado: to, data: todayISO() }] });
  }
  return (
    <Panel titulo="Faturamento da ASF (§11.3)">
      <div className="mb-2 flex flex-wrap gap-1">
        {ASF_FLOW.map((e) => (
          <span
            key={e}
            className={`chip ${atual === e ? 'bg-[var(--color-serges-blue)] text-white border-[var(--color-serges-blue)]' : ''}`}
          >
            {ASF_LABEL[e]}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={!asfPrev(atual)} onClick={() => go(asfPrev(atual))}>
          ‹ Voltar
        </button>
        <button className="btn-primary" disabled={!asfNext(atual)} onClick={() => go(asfNext(atual))}>
          Avançar ›
        </button>
      </div>
      <p className="label mt-2">
        {asfAprovado(atual)
          ? 'Aprovado: card de faturamento e 0600 liberados.'
          : 'Só após aprovado libera o card de faturamento e, em seguida, a 0600.'}
      </p>
      {transicoes.length > 0 && (
        <div className="mt-2 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
          {transicoes.map((t, i) => (
            <div key={i}>{ASF_LABEL[t.estado]} · {t.data}</div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// §11.4 — checklist 0600
function Checklist0600({ ov, set }: { ov?: Override; set: (p: Partial<Override>) => void }) {
  const c = ov?.c0600 ?? {};
  const [campo, setCampo] = useState('');
  const setC = (patch: Partial<NonNullable<Override['c0600']>>) => set({ c0600: { ...c, ...patch } });
  const decimalOk = maxDuasCasas(campo);
  return (
    <Panel titulo="Processo 0600 (§11.4)">
      <Check label="Notas fiscais emitidas pelo financeiro" checked={!!c.nfsEmitidas} onChange={(v) => setC({ nfsEmitidas: v })} />
      <div className="label mb-1 mt-2">Divisão regional conferida</div>
      <Check label="Norte" checked={!!c.norte} onChange={(v) => setC({ norte: v })} />
      <Check label="Capela do Socorro" checked={!!c.capela} onChange={(v) => setC({ capela: v })} />
      <Check label="Parelheiros" checked={!!c.parelheiros} onChange={(v) => setC({ parelheiros: v })} />
      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        <div className="label mb-1">Campo de apoio (máx. 2 casas decimais)</div>
        <input className={`input ${!decimalOk ? 'border-[var(--color-overdue)]' : ''}`} inputMode="decimal" value={campo} onChange={(e) => setCampo(e.target.value)} />
        {!decimalOk && <p className="text-[length:var(--text-caption)] text-[var(--color-overdue)]">Use no máximo duas casas decimais.</p>}
        <p className="label mt-1">O preenchimento real é no portal da ASF; aqui é checklist de apoio.</p>
      </div>
    </Panel>
  );
}

// §11.6 — ZapSign FUNEAS
function ZapSign({ ov, set }: { ov?: Override; set: (p: Partial<Override>) => void }) {
  const [link, setLink] = useState(ov?.zapsignLink ?? '');
  return (
    <Panel titulo="ZapSign — documentação (§11.6)">
      <div className="label mb-1">Link do ZapSign enviado ao Giuliano e ao hospital</div>
      <input className="input" placeholder="https://app.zapsign.com.br/…" value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => set({ zapsignLink: link })} />
      <Check label="OK da fundação recebido (libera os cards finais)" checked={!!ov?.zapsignOk} onChange={(v) => set({ zapsignOk: v })} />
    </Panel>
  );
}

// Alteração do contrato social — envio à contabilidade.
// Entrantes e saintes são itens dentro desta única obrigação (não geram
// obrigação por médico). Gates bloqueiam a conclusão; ver bloqueioConclusao.
function ContratoSocial({
  ov,
  set,
  projetoId,
}: {
  ov?: Override;
  set: (p: Partial<Override>) => void;
  projetoId?: string;
}) {
  const store = useStore();
  const cs = ov?.contratoSocial ?? {};
  const entrantes = cs.entrantes ?? [];
  const saintes = cs.saintes ?? [];
  const setCS = (patch: Partial<NonNullable<Override['contratoSocial']>>) =>
    set({ contratoSocial: { ...cs, ...patch } });

  const [nomeEnt, setNomeEnt] = useState('');
  const [nomeSai, setNomeSai] = useState('');
  const [refData, setRefData] = useState(todayISO());

  const okEnt = entrantes.filter((e) => e.procuracao && e.boleto).length;

  // Destinatários: contatos de contabilidade (Estilocont), e-mails da aba Contatos.
  const emails = [
    ...new Set(
      store.state.contatos
        .filter((c) => c.categoria === 'contabilidade')
        .flatMap((c) => `${c.email ?? ''} ${c.notas ?? ''}`.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? []),
    ),
  ];

  return (
    <Panel titulo="Alteração do contrato social — envio à contabilidade">
      <p className="label mb-2">Prazo teto: dia 20 (antecipa). Trabalhe os pré-requisitos a partir do dia 11.</p>

      <Check
        label="Lista de entradas e saídas confirmada e conferida pelos escalistas (Rodrigo e Danneline)"
        checked={!!cs.confirmacaoEscalistas}
        onChange={(v) => setCS({ confirmacaoEscalistas: v })}
      />

      {/* Médicos entrantes */}
      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="label uppercase">Médicos entrantes</span>
          <span className={`chip ${entrantes.length > 0 && okEnt === entrantes.length ? 'text-[var(--color-done)] border-[var(--color-done)]' : ''}`}>
            procurações e boletos {okEnt} de {entrantes.length}
          </span>
        </div>
        <div className="space-y-1.5">
          {entrantes.map((e) => (
            <div key={e.id} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--color-ink)]">{e.nome}</span>
                <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => setCS({ entrantes: entrantes.filter((x) => x.id !== e.id) })}>
                  remover
                </button>
              </div>
              <Check label="Procuração assinada" checked={!!e.procuracao} onChange={(v) => setCS({ entrantes: entrantes.map((x) => (x.id === e.id ? { ...x, procuracao: v } : x)) })} />
              <Check label="Boleto da cota (compra de cotas) pago" checked={!!e.boleto} onChange={(v) => setCS({ entrantes: entrantes.map((x) => (x.id === e.id ? { ...x, boleto: v } : x)) })} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="input"
            placeholder="Nome do entrante"
            value={nomeEnt}
            onChange={(e) => setNomeEnt(e.target.value)}
            onKeyDown={(e) => {
              // Enter adiciona e mantém o foco no campo para o próximo.
              if (e.key === 'Enter' && nomeEnt.trim()) {
                setCS({ entrantes: [...entrantes, { id: `ent-${crypto.randomUUID().slice(0, 6)}`, nome: nomeEnt.trim() }] });
                setNomeEnt('');
              }
            }}
          />
          <button
            className="btn-secondary"
            disabled={!nomeEnt.trim()}
            onClick={() => {
              setCS({ entrantes: [...entrantes, { id: `ent-${crypto.randomUUID().slice(0, 6)}`, nome: nomeEnt.trim() }] });
              setNomeEnt('');
            }}
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Médicos que saem (apenas conferência) */}
      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        <div className="label mb-1 uppercase">Médicos que saem (conferência)</div>
        <div className="space-y-1">
          {saintes.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-[length:var(--text-label)]">
              <span>{s.nome}</span>
              <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => setCS({ saintes: saintes.filter((x) => x.id !== s.id) })}>
                remover
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="input" placeholder="Nome de quem sai" value={nomeSai} onChange={(e) => setNomeSai(e.target.value)} />
          <button
            className="btn-secondary"
            disabled={!nomeSai.trim()}
            onClick={() => {
              setCS({ saintes: [...saintes, { id: `sai-${crypto.randomUUID().slice(0, 6)}`, nome: nomeSai.trim() }] });
              setNomeSai('');
            }}
          >
            Adicionar
          </button>
        </div>
        <p className="label mt-1">A devolução do boleto de quem sai é tratada à parte (R$ 50, sem prazo crítico) e não bloqueia este envio.</p>
      </div>

      {/* Destinatários e saída */}
      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        <div className="label mb-1">Destinatários (Estilocont)</div>
        {emails.length > 0 ? (
          <a className="btn-secondary" href={`mailto:${emails.join(',')}`}>
            Enviar para {emails.join(', ')}
          </a>
        ) : (
          <p className="label">Cadastre a contabilidade (Estilocont) na aba Contatos.</p>
        )}
        <div className="mt-3 flex gap-2">
          <input className="input" type="date" value={refData} onChange={(e) => setRefData(e.target.value)} />
          <button className="btn-secondary" onClick={() => store.addManual(cardDevolucaoContratoSocial(refData, projetoId))}>
            Gerar devolução de saída (R$ 50)
          </button>
        </div>
      </div>
    </Panel>
  );
}

// §11.9 — checklist da FOPAM de fechamento
function FopamChecklist({ ov, set }: { ov?: Override; set: (p: Partial<Override>) => void }) {
  return (
    <Panel titulo="FOPAM de fechamento (§11.9)">
      <p className="label mb-2">
        Cruze por projeto faturado × custo pago × margem bruta (detalhe na planilha / Oráculo) e use o campo de notas
        para o resumo.
      </p>
      <Check label="E-mail de fechamento enviado ao Bismarck" checked={!!ov?.fopamConfirmado} onChange={(v) => set({ fopamConfirmado: v })} />
    </Panel>
  );
}
