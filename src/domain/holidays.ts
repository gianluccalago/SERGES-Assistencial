import type { Holiday } from './types';
import { utcDate, toISODate, addCalendarDays, dayOfWeek, fromISODate } from './dateUtils';

/**
 * Domingo de Páscoa pelo algoritmo de computus (Meeus/Jones/Butcher).
 * Retorna um Date em UTC.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

/**
 * Conjunto de feriados nacionais (fixos + móveis derivados da Páscoa).
 * É configuração editável: a UI pode acrescentar feriados municipais.
 */
export function brazilianHolidays(year: number): Holiday[] {
  const fixos: Array<[number, number, string]> = [
    [1, 1, 'Confraternização Universal'],
    [4, 21, 'Tiradentes'],
    [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independência'],
    [10, 12, 'Nossa Senhora Aparecida'],
    [11, 2, 'Finados'],
    [11, 15, 'Proclamação da República'],
    [12, 25, 'Natal'],
  ];

  const easter = easterSunday(year);
  const moveis: Array<[Date, string]> = [
    [addCalendarDays(easter, -48), 'Carnaval (segunda)'],
    [addCalendarDays(easter, -47), 'Carnaval (terça)'],
    [addCalendarDays(easter, -2), 'Sexta-feira Santa'],
    [addCalendarDays(easter, 60), 'Corpus Christi'],
  ];

  const fromFixos: Holiday[] = fixos.map(([m, d, nome]) => ({
    date: toISODate(utcDate(year, m, d)),
    nome,
    escopo: 'nacional',
  }));

  const fromMoveis: Holiday[] = moveis.map(([date, nome]) => ({
    date: toISODate(date),
    nome,
    escopo: 'nacional',
  }));

  return [...fromFixos, ...fromMoveis];
}

/** Conjunto de strings ISO de feriados, conveniente para checagem rápida. */
export function holidaySet(holidays: Holiday[]): Set<string> {
  return new Set(holidays.map((h) => h.date));
}

/** Falso em sábado, domingo e feriado. */
export function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const dow = dayOfWeek(date);
  if (dow === 0 || dow === 6) return false;
  return !holidays.has(toISODate(date));
}

/** Primeiro dia útil em ou antes da data informada. */
export function previousBusinessDay(date: Date, holidays: Set<string>): Date {
  let cursor = date;
  while (!isBusinessDay(cursor, holidays)) {
    cursor = addCalendarDays(cursor, -1);
  }
  return cursor;
}

/** Primeiro dia útil em ou após a data informada. */
export function nextBusinessDay(date: Date, holidays: Set<string>): Date {
  let cursor = date;
  while (!isBusinessDay(cursor, holidays)) {
    cursor = addCalendarDays(cursor, 1);
  }
  return cursor;
}

/**
 * Constrói o Set de feriados para um conjunto de anos, combinando os
 * nacionais com feriados extras fornecidos (ex.: municipais).
 */
export function buildHolidaySet(years: number[], extras: Holiday[] = []): Set<string> {
  const all: Holiday[] = [];
  for (const y of years) all.push(...brazilianHolidays(y));
  all.push(...extras);
  return holidaySet(all);
}

/** Reexport util para conveniência de quem consome este módulo. */
export { fromISODate };
