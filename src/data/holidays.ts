import type { Holiday } from '../domain/types';

// Feriados municipais e extras editáveis pelo usuário. Os nacionais são
// derivados em runtime por brazilianHolidays(year). Exemplos comentados de
// Curitiba e São Paulo ficam como referência para o usuário adicionar.

export const seedExtraHolidays: Holiday[] = [
  // { date: '2026-09-08', nome: 'Nossa Senhora da Luz dos Pinhais (Curitiba)', escopo: 'Curitiba' },
  // { date: '2026-01-25', nome: 'Aniversário de São Paulo', escopo: 'São Paulo' },
];
