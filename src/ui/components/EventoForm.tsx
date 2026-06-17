import { useState } from 'react';
import { useStore } from '../../state/store';
import { addCalendarDays, fromISODate, toISODate } from '../../domain/dateUtils';
import { todayISO } from '../format';

// Eventos ficam fora do calendário mensal fixo; o app cria a obrigação quando
// o usuário registra o evento. Presets cobrem os casos descritos na spec.

interface Preset {
  id: string;
  titulo: string;
  baseLabel: string;
  offsetDias: number;
  regraOrigem: string;
  critico: boolean;
}

const PRESETS: Preset[] = [
  {
    id: 'drLuizMarino',
    titulo: 'Pagamento Dr. Luiz Marino (HRL UTI) — NF, 11% desconto',
    baseLabel: 'Fim do plantão',
    offsetDias: 5,
    regraOrigem: 'D+5 após o fim do plantão, com nota fiscal e 11% de desconto.',
    critico: true,
  },
  {
    id: 'boletoCota',
    titulo: 'Boleto da cota do contrato social',
    baseLabel: 'Envio do card de procuração',
    offsetDias: 3,
    regraOrigem: 'Vence 3 dias após o envio do card de procuração.',
    critico: true,
  },
  {
    id: 'saidaContratoSocial',
    titulo: 'Card de pagamento — saída do contrato social (R$ 50)',
    baseLabel: 'Data de referência',
    offsetDias: 0,
    regraOrigem: 'Saída do contrato social: card de R$ 50 sem prazo crítico, pode ir para o mês seguinte.',
    critico: false,
  },
  {
    id: 'custom',
    titulo: '',
    baseLabel: 'Data',
    offsetDias: 0,
    regraOrigem: 'Evento avulso registrado pelo usuário.',
    critico: false,
  },
];

export function EventoForm({
  year,
  month,
  onClose,
}: {
  year: number;
  month: number;
  onClose: () => void;
}) {
  const store = useStore();
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [baseDate, setBaseDate] = useState(todayISO());
  const [tituloCustom, setTituloCustom] = useState('');

  const preset = PRESETS.find((p) => p.id === presetId)!;
  const prazo = toISODate(addCalendarDays(fromISODate(baseDate), preset.offsetDias));
  const titulo = preset.id === 'custom' ? tituloCustom : preset.titulo;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="surface hairline h-full w-full max-w-[460px] space-y-3 overflow-y-auto p-[var(--spacing-24)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[length:var(--text-subheading)]">Registrar evento</h2>
          <button className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        <label className="block">
          <span className="label mb-1 block uppercase">Tipo de evento</span>
          <select className="input" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === 'custom' ? 'Evento avulso…' : p.titulo}
              </option>
            ))}
          </select>
        </label>

        {preset.id === 'custom' && (
          <label className="block">
            <span className="label mb-1 block uppercase">Título</span>
            <input className="input" value={tituloCustom} onChange={(e) => setTituloCustom(e.target.value)} />
          </label>
        )}

        <label className="block">
          <span className="label mb-1 block uppercase">{preset.baseLabel}</span>
          <input className="input" type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
        </label>

        <p className="label">{preset.regraOrigem}</p>
        <p className="label">
          Prazo calculado: <span className="text-[var(--color-bone)]">{prazo}</span>
          {preset.offsetDias ? ` (base + ${preset.offsetDias} dias corridos)` : ''}
        </p>

        <button
          className="btn-primary"
          disabled={!titulo}
          onClick={() => {
            store.addEvento({
              id: `evento:${preset.id}:${Date.now()}`,
              titulo,
              prazoCalculado: prazo,
              regraOrigem: preset.regraOrigem,
              critico: preset.critico,
            });
            onClose();
          }}
        >
          Criar obrigação
        </button>
        <p className="label">
          Mês em foco: {String(month).padStart(2, '0')}/{year}. O evento aparece no calendário do mês do
          seu prazo.
        </p>
      </div>
    </div>
  );
}
