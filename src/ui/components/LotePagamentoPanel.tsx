import { useState } from 'react';
import { useStore } from '../../state/store';
import type { CalendarItem, MedicoCard, MedicoVinculo, SergesConnect } from '../../domain/types';
import { medicoPronto, loteProgresso } from '../../domain/stateMachine';

const CONNECT_LABEL: Record<SergesConnect, string> = {
  realizada: 'Realizada',
  parcialmente: 'Parcialmente',
  nada: 'Nada',
};

// Painel do lote de pagamento: cards de médico, cada um com guardrails próprios
// (§4.3, §11.2). O lote conclui quando todos os cards estão prontos e aprovados.
export function LotePagamentoPanel({ item, contratoSocial }: { item: CalendarItem; contratoSocial: boolean }) {
  const store = useStore();
  const medicos = item.medicos ?? [];
  const { ok, total } = loteProgresso(item);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [vinculo, setVinculo] = useState<MedicoVinculo>('PJ');

  function salvar(novos: MedicoCard[]) {
    store.setMedicos(item.id, novos);
  }
  function patch(id: string, p: Partial<MedicoCard>) {
    salvar(medicos.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }

  return (
    <div className="card mt-[var(--spacing-16)] p-[var(--spacing-16)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="label uppercase">Cards de médico</span>
        <span className={`chip ${total > 0 && ok === total ? 'text-[var(--color-done)] border-[var(--color-done)]' : ''}`}>
          {ok} de {total} prontos
        </span>
      </div>

      {contratoSocial && (
        <div className="mb-2 rounded-[var(--radius-sm)] border border-[var(--color-overdue)] bg-[color-mix(in_srgb,var(--color-overdue)_8%,transparent)] p-2 text-[length:var(--text-caption)] text-[var(--color-overdue)]">
          Projeto exige contrato social · nota fiscal não permitida · risco de quarteirização.
        </div>
      )}

      {/* Marcar fundamentais do lote inteiro (não cria obrigação). */}
      {medicos.length > 0 && (
        <div className="mb-2 flex gap-3">
          <button
            className="btn-ghost"
            onClick={() => salvar(medicos.map((m) => ({ ...m, anexoPresente: true, pixConferido: true })))}
          >
            Marcar fundamentais do lote
          </button>
          <button
            className="btn-ghost"
            onClick={() => salvar(medicos.map((m) => ({ ...m, anexoPresente: false, pixConferido: false })))}
          >
            Desmarcar
          </button>
        </div>
      )}

      <div className="space-y-2">
        {medicos.length === 0 && <div className="label">Nenhum médico no lote ainda.</div>}
        {medicos.map((m) => {
          const pronto = medicoPronto(m);
          return (
            <div key={m.id} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-[var(--color-ink)]">{m.nome}</span>
                  <span className="label ml-2">
                    {m.vinculo === 'socio' ? 'Sócio' : 'PJ'}
                    {m.valor != null ? ` · R$ ${m.valor.toLocaleString('pt-BR')}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${pronto && m.aprovado ? 'text-[var(--color-done)] border-[var(--color-done)]' : ''}`}>
                    {pronto && m.aprovado ? 'pronto' : pronto ? 'aguardando aprovação' : 'incompleto'}
                  </span>
                  <button className="btn-ghost text-[var(--color-overdue)]" onClick={() => salvar(medicos.filter((x) => x.id !== m.id))}>
                    remover
                  </button>
                </div>
              </div>
              <div className="mt-1 space-y-1">
                <Check label="Planilha de origem anexada" checked={!!m.anexoPresente} onChange={(v) => patch(m.id, { anexoPresente: v })} />
                <Check label="PIX conferido (chave corresponde ao vínculo)" checked={!!m.pixConferido} onChange={(v) => patch(m.id, { pixConferido: v })} />
                <div className="flex items-center gap-2">
                  <button className="btn-ghost" onClick={() => patch(m.id, { anexoPresente: true, pixConferido: true })}>
                    Marcar fundamentais
                  </button>
                  <button className="btn-ghost" onClick={() => patch(m.id, { anexoPresente: false, pixConferido: false })}>
                    Desmarcar
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[length:var(--text-label)]">
                  <span className="label">SERGES Connect:</span>
                  <select
                    className="select w-auto"
                    value={m.sergesConnect ?? ''}
                    onChange={(e) => patch(m.id, { sergesConnect: (e.target.value || undefined) as SergesConnect | undefined })}
                  >
                    <option value="">—</option>
                    {(Object.keys(CONNECT_LABEL) as SergesConnect[]).map((k) => (
                      <option key={k} value={k}>
                        {CONNECT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <Check
                  label="Aprovado"
                  checked={!!m.aprovado}
                  onChange={(v) => patch(m.id, { aprovado: v })}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Adicionar médico */}
      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        <div className="label mb-1">Adicionar médico</div>
        <div className="flex flex-wrap gap-2">
          <input className="input w-auto flex-1 min-w-[140px]" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input className="input w-[120px]" inputMode="decimal" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
          <select className="select w-auto" value={vinculo} onChange={(e) => setVinculo(e.target.value as MedicoVinculo)}>
            <option value="PJ">PJ</option>
            <option value="socio">Sócio</option>
          </select>
          <button
            className="btn-secondary"
            disabled={!nome.trim()}
            onClick={() => {
              salvar([
                ...medicos,
                {
                  id: `med-${crypto.randomUUID().slice(0, 8)}`,
                  nome: nome.trim(),
                  valor: valor ? Number(valor.replace(',', '.')) : undefined,
                  vinculo,
                },
              ]);
              setNome('');
              setValor('');
            }}
          >
            Adicionar
          </button>
        </div>
        {/* Aviso (não bloqueia) ao adicionar PJ em projeto com contrato social. */}
        {contratoSocial && vinculo === 'PJ' && (
          <p className="mt-1 text-[length:var(--text-caption)] text-[var(--color-overdue)]">
            Projeto exige contrato social · nota fiscal não permitida · risco de quarteirização. (apenas alerta)
          </p>
        )}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[length:var(--text-label)]">
      <input type="checkbox" className="h-4 w-4 accent-[var(--color-serges-blue)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
