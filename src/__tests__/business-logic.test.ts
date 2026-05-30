/**
 * Testes para lógica crítica de negócio
 * Executar: npx vitest run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildConfirmationMsg,
  buildReminderMsg,
  buildCancellationMsg,
  buildCustomMsg,
} from '../services/whatsapp';

// ── Mock dos env vars ────────────────────────────────────────
vi.stubEnv('VITE_EVO_URL',      'https://evo.test.com');
vi.stubEnv('VITE_EVO_INSTANCE', 'test-instance');
vi.stubEnv('VITE_EVO_APIKEY',   'test-api-key');

const mockAppt = {
  customerName:     'João Silva',
  customerPhone:    '5511999999999',
  serviceName:      'Corte Degradê',
  professionalName: 'Gustavo',
  date:             '2026-06-15',
  time:             '14:00',
  tenantName:       'Barbearia Dom Pedro',
  tenantPhone:      '(11) 98765-4321',
};

// ── WhatsApp message builders ────────────────────────────────
describe('buildConfirmationMsg', () => {
  it('contém o nome do cliente', () => {
    expect(buildConfirmationMsg(mockAppt)).toContain('João Silva');
  });
  it('contém o serviço', () => {
    expect(buildConfirmationMsg(mockAppt)).toContain('Corte Degradê');
  });
  it('contém o horário', () => {
    expect(buildConfirmationMsg(mockAppt)).toContain('14:00');
  });
  it('contém o nome do salão', () => {
    expect(buildConfirmationMsg(mockAppt)).toContain('Barbearia Dom Pedro');
  });
  it('formata a data em pt-BR', () => {
    expect(buildConfirmationMsg(mockAppt)).toContain('15 de Jun');
  });
});

describe('buildReminderMsg', () => {
  it('menciona "amanhã"', () => {
    expect(buildReminderMsg(mockAppt).toLowerCase()).toContain('amanhã');
  });
  it('contém o nome do cliente', () => {
    expect(buildReminderMsg(mockAppt)).toContain('João Silva');
  });
});

describe('buildCancellationMsg', () => {
  it('menciona cancelamento', () => {
    const msg = buildCancellationMsg(mockAppt).toLowerCase();
    expect(msg).toContain('cancelado');
  });
  it('contém o serviço cancelado', () => {
    expect(buildCancellationMsg(mockAppt)).toContain('Corte Degradê');
  });
});

describe('buildCustomMsg', () => {
  it('substitui todas as variáveis', () => {
    const template = 'Olá {cliente}, seu {servico} com {profissional} em {data} às {hora} na {salao}.';
    const result   = buildCustomMsg(template, mockAppt);
    expect(result).toContain('João Silva');
    expect(result).toContain('Corte Degradê');
    expect(result).toContain('Gustavo');
    expect(result).toContain('14:00');
    expect(result).toContain('Barbearia Dom Pedro');
    expect(result).not.toContain('{cliente}');
    expect(result).not.toContain('{servico}');
    expect(result).not.toContain('{profissional}');
    expect(result).not.toContain('{hora}');
    expect(result).not.toContain('{salao}');
  });
  it('substitui múltiplas ocorrências da mesma variável', () => {
    const template = '{cliente} é bem-vindo, {cliente}!';
    const result   = buildCustomMsg(template, mockAppt);
    expect(result).toBe('João Silva é bem-vindo, João Silva!');
  });
});

// ── Lógica de conflito de agendamento ────────────────────────
describe('Conflito de agendamento', () => {
  // Simula a lógica de verificação de conflito do ClientAdminPanel
  const checkConflict = (
    appointments: { date: string; time: string; professionalId: string; status: string }[],
    newDate: string,
    newTime: string,
    newProfId: string
  ) => appointments.some(a =>
    a.date === newDate &&
    a.time === newTime &&
    a.professionalId === newProfId &&
    a.status !== 'cancelled'
  );

  const existingAppts = [
    { date: '2026-06-15', time: '14:00', professionalId: 'prof-1', status: 'confirmed' },
    { date: '2026-06-15', time: '15:00', professionalId: 'prof-1', status: 'confirmed' },
    { date: '2026-06-15', time: '14:00', professionalId: 'prof-2', status: 'confirmed' },
    { date: '2026-06-15', time: '14:00', professionalId: 'prof-1', status: 'cancelled' }, // cancelado não conta
  ];

  it('detecta conflito real', () => {
    expect(checkConflict(existingAppts, '2026-06-15', '14:00', 'prof-1')).toBe(true);
  });

  it('não detecta conflito com profissional diferente', () => {
    expect(checkConflict(existingAppts, '2026-06-15', '14:00', 'prof-3')).toBe(false);
  });

  it('não detecta conflito em horário diferente', () => {
    expect(checkConflict(existingAppts, '2026-06-15', '16:00', 'prof-1')).toBe(false);
  });

  it('não detecta conflito em data diferente', () => {
    expect(checkConflict(existingAppts, '2026-06-16', '14:00', 'prof-1')).toBe(false);
  });

  it('ignora agendamentos cancelados', () => {
    // prof-1 tem horário das 14:00 mas com status cancelado
    const onlyCancelled = [{ date: '2026-06-15', time: '14:00', professionalId: 'prof-1', status: 'cancelled' }];
    expect(checkConflict(onlyCancelled, '2026-06-15', '14:00', 'prof-1')).toBe(false);
  });
});

// ── Cálculo de comissões ─────────────────────────────────────
describe('Cálculo de comissões', () => {
  const calcCommission = (totalEarned: number, commissionPct: number) =>
    totalEarned * (commissionPct / 100);

  it('calcula 40% de comissão corretamente', () => {
    expect(calcCommission(500, 40)).toBeCloseTo(200);
  });
  it('calcula lucro do salão corretamente', () => {
    const total = 500;
    const comm  = calcCommission(total, 40);
    expect(total - comm).toBeCloseTo(300);
  });
  it('comissão zero resulta em lucro total para o salão', () => {
    expect(calcCommission(500, 0)).toBe(0);
  });
  it('comissão 100% repassa tudo ao profissional', () => {
    expect(calcCommission(500, 100)).toBe(500);
  });
});

// ── Normalização de telefone ─────────────────────────────────
describe('Normalização de número de telefone', () => {
  // Copia a função interna do whatsapp.ts
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    if (digits.length === 11 || digits.length === 10) return `55${digits}`;
    return digits;
  };

  it('adiciona 55 em número de 11 dígitos', () => {
    expect(normalizePhone('11999999999')).toBe('5511999999999');
  });
  it('mantém 55 se já presente', () => {
    expect(normalizePhone('5511999999999')).toBe('5511999999999');
  });
  it('remove formatação (parênteses, traços, espaços)', () => {
    expect(normalizePhone('(11) 99999-9999')).toBe('5511999999999');
  });
  it('adiciona 55 em número de 10 dígitos (fixo)', () => {
    expect(normalizePhone('1133334444')).toBe('551133334444');
  });
});
