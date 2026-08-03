import { useState } from 'react';
import { useStore } from '../../state/store';
import type { AjusteDiaUtil, FrequenciaRecorrencia, ManualObligation, ObligationTipo, Recorrencia } from '../../domain/types';
import { descreverRecorrencia } from '../../domain/recorrencia';
import { fromISODate } from '../../domain/dateUtils';
import { TIPO_LABEL, todayISO } from '../format';

const TIPOS: ObligationTipo[] = [
  'evento',
  'lotePagamento',
  'faturamentoIniciar',
  'faturamentoCard',
  'fixa',
  'apresentacao',
  'fechamento',
];

// Presets dos eventos descritos na spec (4.4), como atalhos de preenchimento.
const PRESETS: Array<{ id: string; titulo: string; notas: string; critico: boolean }> = [
  {
    id: 'drLuiz',
    titulo: 'Pagamento Dr. Luiz Marino (HRL UTI)',
    notas: 'D+5 após o fim do plantão, com nota fiscal e 11% de desconto.',
    critico: true,
  },
  {
    id: 'boleto',
    titulo: 'Boleto da cota do contrato social',
    notas: 'Vence 3 dias após o envio do card de procuração.',
    critico: true,
  },
  {
    id: 'saida',
    titulo: 'Card de pagamento — saída do contrato social (R$ 50)',
    notas: 'Sem prazo crítico; pode ir para o mês seguinte.',
    critico: false,
  },
];

function novaManual(): ManualObligation {
  return {
    id: `manual:${crypto.randomUUID()}`,
    titulo: '',
    data: todayISO(),
    tipo: 'evento',
    estado: 'pendente',
  };
}

export function ManualForm({
  editId,
  onClose,
}: {
  editId?: string;
  onClose: () => void;
}) {
  const store = useStore();
  const existing = editId ? store.state.manualObligations.find((m) => m.id === editId) : undefined;
  const [draft, setDraft] = useState<ManualObligation>(existing ? { ...existing } : novaManual());

  function set<K extends keyof ManualObligation>(key: K, value: ManualObligation[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="drawer h-full w-full max-w-[480px] space-y-3 overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-surface)] p-[var(--spacing-24)] shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[length:var(--text-heading)]">{existing ? 'Editar obrigação' : 'Nova obrigação'}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {!existing && (
          <div>
            <span className="label mb-1 block uppercase">Atalhos de evento</span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="chip hover:border-[var(--color-serges-blue)]"
                  onClick={() => setDraft((d) => ({ ...d, titulo: p.titulo, notas: p.notas, tipo: 'evento', critico: p.critico }))}
                >
                  {p.titulo.length > 28 ? p.titulo.slice(0, 28) + '…' : p.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Título">
          <input className="input" value={draft.titulo} onChange={(e) => set('titulo', e.target.value)} />
        </Field>
        <Field label="Data">
          <input className="input" type="date" value={draft.data} onChange={(e) => set('data', e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select className="select" value={draft.tipo} onChange={(e) => set('tipo', e.target.value as ObligationTipo)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Projeto (opcional)">
          <select
            className="select"
            value={draft.projetoId ?? ''}
            onChange={(e) => set('projetoId', e.target.value || undefined)}
          >
            <option value="">—</option>
            {store.state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsável">
          <input className="input" value={draft.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value || undefined)} />
        </Field>
        <RecorrenciaEditor
          valor={draft.recorrencia}
          dataBase={draft.data}
          onChange={(r) => set('recorrencia', r)}
        />

        <Field label="Notas">
          <textarea className="input" rows={3} value={draft.notas ?? ''} onChange={(e) => set('notas', e.target.value || undefined)} />
        </Field>

        <div className="flex gap-2 pt-2">
          <button
            className="btn-primary"
            disabled={!draft.titulo || !draft.data}
            onClick={() => {
              if (existing) store.updateManual(draft);
              else store.addManual(draft);
              onClose();
            }}
          >
            {existing ? 'Salvar' : 'Criar obrigação'}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          {existing && (
            <button
              className="btn-ghost text-[var(--color-overdue)]"
              onClick={() => {
                store.removeManual(existing.id);
                onClose();
              }}
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block uppercase">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Recorrência: "não repete" (padrão) ou a cada N dias/semanas/meses/anos, com
// data-limite opcional. A tarefa guarda a regra; as datas são calculadas na
// hora — mudar a regra depois reescreve todas as repetições futuras.
// ---------------------------------------------------------------------------
const FREQ_LABEL: Record<FrequenciaRecorrencia, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
};
const UNIDADE: Record<FrequenciaRecorrencia, string> = {
  diaria: 'dia(s)',
  semanal: 'semana(s)',
  mensal: 'mês(es)',
  anual: 'ano(s)',
};
const DOW_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DOW_TITULO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MODO_LABEL: Record<AjusteDiaUtil, string> = {
  nenhum: 'Manter a data, mesmo em fim de semana/feriado',
  antecipa: 'Antecipar para o dia útil anterior',
  adia: 'Adiar para o próximo dia útil',
};

function RecorrenciaEditor({
  valor,
  dataBase,
  onChange,
}: {
  valor?: Recorrencia;
  dataBase: string;
  onChange: (r: Recorrencia | undefined) => void;
}) {
  const r = valor;
  const set = (patch: Partial<Recorrencia>) =>
    onChange({ frequencia: 'semanal', intervalo: 1, ...r, ...patch });

  const dowBase = dataBase ? fromISODate(dataBase).getUTCDay() : 1;
  const dias = r?.diasSemana ?? [];
  const toggleDia = (d: number) =>
    set({ diasSemana: dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort((a, b) => a - b) });

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <label className="block">
        <span className="label mb-1 block uppercase">Repetir</span>
        <select
          className="select"
          value={r?.frequencia ?? 'nao'}
          onChange={(e) =>
            e.target.value === 'nao'
              ? onChange(undefined)
              : set({ frequencia: e.target.value as FrequenciaRecorrencia })
          }
        >
          <option value="nao">Não repete (data única)</option>
          {(Object.keys(FREQ_LABEL) as FrequenciaRecorrencia[]).map((f) => (
            <option key={f} value={f}>{FREQ_LABEL[f]}</option>
          ))}
        </select>
      </label>

      {r && (
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-[length:var(--text-label)]">
            A cada
            <input
              className="input w-[72px] py-1 text-center"
              type="number"
              min={1}
              max={99}
              value={r.intervalo}
              onChange={(e) => set({ intervalo: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
            />
            {UNIDADE[r.frequencia]}
          </label>

          {r.frequencia === 'semanal' && (
            <div>
              <span className="label mb-1 block">Dias da semana</span>
              <div className="flex gap-1">
                {DOW_CURTO.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pill w-9 justify-center px-0"
                    data-active={dias.length ? dias.includes(i) : i === dowBase}
                    title={DOW_TITULO[i]}
                    onClick={() => toggleDia(i)}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="label mt-1">Sem nenhum marcado, usa o dia da semana da data acima.</p>
            </div>
          )}

          <label className="block">
            <span className="label mb-1 block">Caindo em fim de semana ou feriado</span>
            <select
              className="select"
              value={r.modo ?? 'nenhum'}
              onChange={(e) => set({ modo: e.target.value as AjusteDiaUtil })}
            >
              {(Object.keys(MODO_LABEL) as AjusteDiaUtil[]).map((m) => (
                <option key={m} value={m}>{MODO_LABEL[m]}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label mb-1 block">Repetir até (opcional — vazio = para sempre)</span>
            <input
              className="input"
              type="date"
              value={r.ate ?? ''}
              onChange={(e) => set({ ate: e.target.value || undefined })}
            />
          </label>

          <p className="rounded-[var(--radius-sm)] bg-[var(--color-serges-blue-tint-soft)] px-2 py-1.5 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
            {descreverRecorrencia(r)} A 1ª vez é na data acima.
          </p>
        </div>
      )}
    </div>
  );
}
