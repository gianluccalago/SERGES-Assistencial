import type { ResolvedObligation } from '../useObligations';

// Selos derivados que coexistem com o status (§4.5): Atrasada (vermelho, único
// alerta), Crítico, Escalado, Aprovação > 24h, e contratante atrasado.
export function Selos({ ro }: { ro: ResolvedObligation }) {
  return (
    <>
      {ro.atrasada && (
        <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Atrasada</span>
      )}
      {ro.contratanteAtrasado && (
        <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Contratante atrasado</span>
      )}
      {ro.item.resolucaoMes === 'semAtuacao' && <span className="chip">Sem atuação</span>}
      {ro.item.resolucaoMes === 'faturadoParcialmente' && <span className="chip">Faturado parcial</span>}
      {ro.critico && <span className="chip">Crítico</span>}
      {ro.aprovacaoEstourada && (
        <span className="chip border-[var(--color-overdue)] text-[var(--color-overdue)]">Aprovação &gt; 24h</span>
      )}
    </>
  );
}
