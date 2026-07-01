// Estado vazio como convite, não área em branco: selo de concluído + mensagem.
export function TudoEmDia({ texto = 'Tudo em dia por aqui.' }: { texto?: string }) {
  return (
    <div className="card flex flex-col items-center p-[var(--spacing-32)] text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-done-tint)] text-[var(--color-done)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      </span>
      <div className="mt-3 font-[family-name:var(--font-display)] text-[length:var(--text-subheading)] font-semibold text-[var(--color-ink)]">
        Tudo em dia
      </div>
      <div className="label mt-1">{texto}</div>
    </div>
  );
}
