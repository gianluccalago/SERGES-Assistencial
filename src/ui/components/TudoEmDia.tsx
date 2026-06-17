// Estado vazio amigável: quando não há pendências, em vez de área em branco.
export function TudoEmDia({ texto = 'Tudo em dia por aqui.' }: { texto?: string }) {
  return (
    <div className="card p-[var(--spacing-32)] text-center">
      <div className="text-[length:var(--text-heading)] font-semibold text-[var(--color-done)]">✓ Tudo em dia</div>
      <div className="label mt-1">{texto}</div>
    </div>
  );
}
