import { describe, it, expect } from 'vitest';
import { generateOccurrences, weekdayKey, RECURRENCE_HORIZON_DAYS, RECURRENCE_MAX_OCCURRENCES } from '../lib/recurrence';

// ── Recorrência de agendamentos ──────────────────────────────
describe('generateOccurrences', () => {
  it('diariamente por 4 recorrências gera 4 datas (inclui a primeira)', () => {
    expect(generateOccurrences('2026-10-08', { freq: 'daily', endAfterCount: 4 }))
      .toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });
  it('semanalmente mantém o dia da semana', () => {
    const dates = generateOccurrences('2026-10-08', { freq: 'weekly', endAfterCount: 4 });
    expect(dates).toEqual(['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']);
    expect(new Set(dates.map(weekdayKey))).toEqual(new Set(['qui']));
  });
  it('mensalmente recua para o último dia em meses curtos', () => {
    expect(generateOccurrences('2027-01-31', { freq: 'monthly', endAfterCount: 3 }))
      .toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });
  it('a cada X dias respeita o intervalo', () => {
    expect(generateOccurrences('2026-10-08', { freq: 'custom', intervalDays: 10, endAfterCount: 3 }))
      .toEqual(['2026-10-08', '2026-10-18', '2026-10-28']);
  });
  it('com contagem não é cortado pelo horizonte de 6 meses', () => {
    expect(generateOccurrences('2026-10-08', { freq: 'monthly', endAfterCount: 12 }).length).toBe(12);
  });
  it('indeterminado para no horizonte', () => {
    const dates = generateOccurrences('2026-10-08', { freq: 'weekly', endAfterCount: null });
    expect(dates.length).toBe(Math.floor(RECURRENCE_HORIZON_DAYS / 7) + 1);
  });
  it('nunca passa do teto de ocorrências', () => {
    expect(generateOccurrences('2026-10-08', { freq: 'daily', endAfterCount: null }).length)
      .toBe(RECURRENCE_MAX_OCCURRENCES);
    expect(generateOccurrences('2026-10-08', { freq: 'daily', endAfterCount: 500 }).length)
      .toBe(RECURRENCE_MAX_OCCURRENCES);
  });
  it('1 recorrência gera só a primeira data', () => {
    expect(generateOccurrences('2026-10-08', { freq: 'daily', endAfterCount: 1 })).toEqual(['2026-10-08']);
  });
});
