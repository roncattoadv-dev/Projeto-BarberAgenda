// src/lib/recurrence.ts
// Geração das datas de um agendamento recorrente. As ocorrências são
// materializadas como agendamentos normais no momento da criação — não existe
// regra de recorrência persistida no banco.

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Só para freq 'custom': repetir a cada N dias */
  intervalDays?: number;
  /** Encerrar após N ocorrências (contando a primeira); null = indeterminado */
  endAfterCount: number | null;
}

/** "Indeterminado" gera ocorrências até este horizonte a partir da primeira data */
export const RECURRENCE_HORIZON_DAYS = 180;
/** Teto de agendamentos criados por série, qualquer que seja a regra */
export const RECURRENCE_MAX_OCCURRENCES = 90;

const WEEKDAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
// Aritmética em UTC para não escorregar um dia em virada de horário de verão
const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Chave do dia da semana ('dom'..'sab') de uma data YYYY-MM-DD */
export function weekdayKey(dateKey: string): string {
  return WEEKDAY_KEYS[fromKey(dateKey).getUTCDay()];
}

/**
 * Datas (YYYY-MM-DD) de todas as ocorrências, incluindo a primeira.
 * Mensal mantém o dia do mês e recua para o último dia quando o mês é mais
 * curto (31/01 → 28/02 → 31/03).
 */
export function generateOccurrences(startDate: string, rule: RecurrenceRule): string[] {
  const start = fromKey(startDate);
  if (Number.isNaN(start.getTime())) return [];

  // Indeterminado é limitado pelo horizonte; com contagem, só pelo teto
  const limit = rule.endAfterCount === null
    ? start.getTime() + RECURRENCE_HORIZON_DAYS * 86400000
    : Infinity;
  const maxCount = rule.endAfterCount === null
    ? RECURRENCE_MAX_OCCURRENCES
    : Math.min(RECURRENCE_MAX_OCCURRENCES, Math.max(1, Math.floor(rule.endAfterCount)));
  const stepDays = rule.freq === 'daily' ? 1
    : rule.freq === 'weekly' ? 7
    : Math.max(1, Math.floor(rule.intervalDays ?? 1));

  const dates: string[] = [];
  for (let i = 0; dates.length < maxCount; i++) {
    let d: Date;
    if (rule.freq === 'monthly') {
      const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)));
    } else {
      d = new Date(start.getTime() + i * stepDays * 86400000);
    }
    if (d.getTime() > limit) break;
    dates.push(toKey(d));
  }
  return dates;
}
