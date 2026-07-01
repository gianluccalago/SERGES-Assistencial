import type { ReactNode } from 'react';
import { useGestorGate } from '../../auth/AuthProvider';

/**
 * Páginas administrativas (projetos, feriados, usuários) são exclusivas do
 * gestor. A equipe vê o conteúdo, mas em modo leitura, com o motivo explícito —
 * o <fieldset disabled> desativa todos os controles internos.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { isGestor } = useGestorGate();
  if (isGestor) return <>{children}</>;
  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[rgba(77,125,255,0.35)] bg-[var(--color-serges-blue-tint-soft)] px-3 py-2 text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-serges-blue-strong)]">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Ação exclusiva do gestor — você está em modo leitura.
      </div>
      <fieldset disabled className="min-w-0 border-0 p-0 opacity-70">
        {children}
      </fieldset>
    </div>
  );
}
