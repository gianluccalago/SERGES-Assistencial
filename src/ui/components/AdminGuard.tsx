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
      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-serges-blue-tint)] px-3 py-2 text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
        Ação exclusiva do gestor — você está em modo leitura.
      </div>
      <fieldset disabled className="min-w-0 border-0 p-0 opacity-70">
        {children}
      </fieldset>
    </div>
  );
}
