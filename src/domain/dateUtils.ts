// Aritmética de datas em TypeScript puro. Datas são tratadas em UTC para
// evitar deslocamentos por fuso/horário de verão. A camada de UI formata.

/** Cria um Date em UTC a partir de ano/mês(1-12)/dia. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Converte um Date para ISO YYYY-MM-DD usando os campos UTC. */
export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Faz o parse de YYYY-MM-DD para um Date em UTC. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return utcDate(y, m, d);
}

/** Soma n dias corridos (calendário). n pode ser negativo. */
export function addCalendarDays(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

/** 0 = domingo ... 6 = sábado, em UTC. */
export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/** Último dia do mês (1-12). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Garante que um dia nominal (ex.: 31) não estoure o mês corrente. */
export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month));
}

/** Competência YYYY-MM a partir de ano/mês. */
export function competencia(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
