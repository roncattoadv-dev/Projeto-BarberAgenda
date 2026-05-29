/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tenant, Service, Professional, Product, Appointment, Payment, Customer, Coupon, SupportTicket, AuditLog } from './types';

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant-dom-pedro',
    name: 'Barbearia Dom Pedro',
    slug: 'dompedro',
    logo: '💈',
    banner: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80',
    phone: '(11) 98765-4321',
    address: 'Av. Paulista, 1200 - Bela Vista, São Paulo - SP',
    instagram: '@barbeariadompedro',
    status: 'active',
    plan: 'mensal',
    trialEndsAt: '2026-06-08',
    subscriptionEndsAt: '2026-12-31',
    mrr: 149.90,
    businessHours: ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
    businessDays: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  },
  {
    id: 'tenant-studio-bella',
    name: 'Studio Bella Donna',
    slug: 'belladonna',
    logo: '💅',
    banner: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
    phone: '(11) 97654-3210',
    address: 'Rua Oscar Freire, 850 - Jardins, São Paulo - SP',
    instagram: '@studiobelladonna',
    status: 'trial',
    plan: 'trial',
    trialEndsAt: '2026-06-05', // 7 days remaining from baseline
    subscriptionEndsAt: '2026-06-05',
    mrr: 0.00,
    businessHours: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    businessDays: ['ter', 'qua', 'qui', 'sex', 'sab']
  },
  {
    id: 'tenant-lenox-barber',
    name: 'Lenox Premium Club',
    slug: 'lenox',
    logo: '✂️',
    banner: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    phone: '(21) 99123-4567',
    address: 'Av. Atlântica, 1720 - Copacabana, Rio de Janeiro - RJ',
    instagram: '@lenoxbarberclub',
    status: 'blocked',
    plan: 'anual',
    trialEndsAt: '2026-03-10',
    subscriptionEndsAt: '2026-05-15', // Overdue subscription (blocked)
    mrr: 1199.00,
    businessHours: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'],
    businessDays: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  }
];

export const INITIAL_SERVICES: Service[] = [
  // Tenant A: Barbearia Dom Pedro
  {
    id: 'srv-corte-dp',
    tenantId: 'tenant-dom-pedro',
    name: 'Corte Degradê Premium',
    durationMinutes: 40,
    price: 60.00,
    category: 'Cabelo',
    description: 'Corte moderno com lavagem, finalização e massagem capilar.'
  },
  {
    id: 'srv-barba-dp',
    tenantId: 'tenant-dom-pedro',
    name: 'Barboterapia Real',
    durationMinutes: 30,
    price: 50.00,
    category: 'Barba',
    description: 'Toalha quente, óleos essenciais e barbear tradicional com navalha.'
  },
  {
    id: 'srv-combo-dp',
    tenantId: 'tenant-dom-pedro',
    name: 'Combo Cabelo & Barba',
    durationMinutes: 60,
    price: 100.00,
    category: 'Combo',
    description: 'Serviço completo Signature com preço reduzido e bebida grátis.'
  },
  {
    id: 'srv-estetica-dp',
    tenantId: 'tenant-dom-pedro',
    name: 'Limpeza de Pele Express',
    durationMinutes: 30,
    price: 45.00,
    category: 'Estética',
    description: 'Esfoliação caprichada, máscara de carvão ativado e hidratação.'
  },

  // Tenant B: Studio Bella Donna
  {
    id: 'srv-unhas-bd',
    tenantId: 'tenant-studio-bella',
    name: 'Pé e Mão (Manicure & Pedicure)',
    durationMinutes: 60,
    price: 85.00,
    category: 'Unhas',
    description: 'Cutilagem caprichada e esmaltação importada de alta duração.'
  },
  {
    id: 'srv-escova-bd',
    tenantId: 'tenant-studio-bella',
    name: 'Escova reconstrutora & Lavado',
    durationMinutes: 45,
    price: 120.00,
    category: 'Cabelo',
    description: 'Lavagem com xampu reconstrutor e escovação impecável.'
  },
  {
    id: 'srv-mechas-bd',
    tenantId: 'tenant-studio-bella',
    name: 'Mechas Definição Iluminada',
    durationMinutes: 180,
    price: 450.00,
    category: 'Cabelo',
    description: 'Tonalização profissional de alta proteção.'
  },
  {
    id: 'srv-sobrancelha-bd',
    tenantId: 'tenant-studio-bella',
    name: 'Design de Sobrancelha com Henrique',
    durationMinutes: 30,
    price: 55.00,
    category: 'Estética',
    description: 'Marcação aurea geométrica com pinça de precisão.'
  }
];

export const INITIAL_PROFESSIONALS: Professional[] = [
  // Barbearia Dom Pedro
  {
    id: 'prof-gustavo',
    tenantId: 'tenant-dom-pedro',
    name: 'Gustavo Lima (Guga)',
    role: 'Barbeiro Master',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    rating: 4.9,
    services: ['srv-corte-dp', 'srv-barba-dp', 'srv-combo-dp'],
    commissionPercentage: 40
  },
  {
    id: 'prof-felipe',
    tenantId: 'tenant-dom-pedro',
    name: 'Felipe Melo (Liso)',
    role: 'Barbeiro Visagista',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    rating: 4.8,
    services: ['srv-corte-dp', 'srv-barba-dp', 'srv-estetica-dp', 'srv-combo-dp'],
    commissionPercentage: 35
  },

  // Studio Bella Donna
  {
    id: 'prof-ana',
    tenantId: 'tenant-studio-bella',
    name: 'Ana Cláudia Silva',
    role: 'Hair Stylist Core',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    rating: 5.0,
    services: ['srv-escova-bd', 'srv-mechas-bd'],
    commissionPercentage: 50
  },
  {
    id: 'prof-mariana',
    tenantId: 'tenant-studio-bella',
    name: 'Mariana Souza',
    role: 'Nail Designer Specialist',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    rating: 4.7,
    services: ['srv-unhas-bd', 'srv-sobrancelha-bd'],
    commissionPercentage: 45
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-pomada',
    tenantId: 'tenant-dom-pedro',
    name: 'Pomada Modeladora Efeito Matte DP',
    price: 45.00,
    costPrice: 18.00,
    stock: 22,
    minStock: 5,
    category: 'Cabelo'
  },
  {
    id: 'prod-oleo',
    tenantId: 'tenant-dom-pedro',
    name: 'Óleo Hidratante de Barba (Dom Imperial)',
    price: 38.00,
    costPrice: 15.00,
    stock: 3, // ALERTA DE ESTOQUE BAIXO
    minStock: 6,
    category: 'Barba'
  },
  {
    id: 'prod-shampoo',
    tenantId: 'tenant-dom-pedro',
    name: 'Shampoo Anticaspa Tea Tree',
    price: 49.90,
    costPrice: 21.00,
    stock: 14,
    minStock: 4,
    category: 'Cabelo'
  },

  // Studio Bella Donna
  {
    id: 'prod-esmalte',
    tenantId: 'tenant-studio-bella',
    name: 'Kit Esmaltes Hipoalergênico OPI',
    price: 75.00,
    costPrice: 32.00,
    stock: 10,
    minStock: 5,
    category: 'Unhas'
  },
  {
    id: 'prod-mascara',
    tenantId: 'tenant-studio-bella',
    name: 'Máscara Hidratação Profunda Kérastase',
    price: 289.00,
    costPrice: 140.00,
    stock: 2, // ALERTA DE ESTOQUE BAIXO
    minStock: 3,
    category: 'Cabelo'
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-thiago',
    tenantId: 'tenant-dom-pedro',
    name: 'Thiago Alencar',
    email: 'thiago.alencar@gmail.com',
    phone: '(11) 98888-1111',
    notes: 'Tem preferência por café expresso e corte degradê bem disfarçado.',
    createdAt: '2026-01-10'
  },
  {
    id: 'cust-rodrigo',
    tenantId: 'tenant-dom-pedro',
    name: 'Rodrigo Mello',
    email: 'rodrigo.mello@uol.com.br',
    phone: '(11) 97777-2222',
    notes: 'Usa barba alinhada curta.',
    createdAt: '2026-02-15'
  },
  {
    id: 'cust-diego',
    tenantId: 'tenant-dom-pedro',
    name: 'Diego Fernandes',
    email: 'diego@rocketseat.com.br',
    phone: '(11) 96666-3333',
    notes: 'Gosta de finalizar com pomada matte seca.',
    createdAt: '2026-05-20'
  },

  // Studio Bella Donna
  {
    id: 'cust-karla',
    tenantId: 'tenant-studio-bella',
    name: 'Karla Albuquerque',
    email: 'karla.albuq@outlook.com',
    phone: '(11) 95555-4444',
    notes: 'Faz manicure toda sexta. Gosta de tons nudes.',
    createdAt: '2026-03-01'
  },
  {
    id: 'cust-juliana',
    tenantId: 'tenant-studio-bella',
    name: 'Juliana Pires',
    email: 'jupi@hotmail.com',
    phone: '(11) 94444-5555',
    notes: 'Costuma pintar com a Ana de mechas.',
    createdAt: '2026-04-12'
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  // We'll map timestamps to today (2026-05-29) and surrounding days
  {
    id: 'appt-1',
    tenantId: 'tenant-dom-pedro',
    serviceId: 'srv-corte-dp',
    professionalId: 'prof-gustavo',
    customerId: 'cust-thiago',
    customerName: 'Thiago Alencar',
    customerPhone: '(11) 98888-1111',
    date: '2026-05-29',
    time: '09:00',
    durationMinutes: 40,
    price: 60.00,
    status: 'attended',
    notes: 'Bebida: Água com gás'
  },
  {
    id: 'appt-2',
    tenantId: 'tenant-dom-pedro',
    serviceId: 'srv-barba-dp',
    professionalId: 'prof-gustavo',
    customerId: 'cust-rodrigo',
    customerName: 'Rodrigo Mello',
    customerPhone: '(11) 97777-2222',
    date: '2026-05-29',
    time: '10:30',
    durationMinutes: 30,
    price: 50.00,
    status: 'confirmed'
  },
  {
    id: 'appt-3',
    tenantId: 'tenant-dom-pedro',
    serviceId: 'srv-combo-dp',
    professionalId: 'prof-felipe',
    customerId: 'cust-diego',
    customerName: 'Diego Fernandes',
    customerPhone: '(11) 96666-3333',
    date: '2026-05-29',
    time: '14:00',
    durationMinutes: 60,
    price: 100.00,
    status: 'confirmed',
    notes: 'Primeira vez no salão'
  },
  {
    id: 'appt-4',
    tenantId: 'tenant-dom-pedro',
    serviceId: 'srv-estetica-dp',
    professionalId: 'prof-felipe',
    customerId: 'cust-thiago',
    customerName: 'Thiago Alencar',
    customerPhone: '(11) 98888-1111',
    date: '2026-05-29',
    time: '16:00',
    durationMinutes: 30,
    price: 45.00,
    status: 'pending'
  },
  {
    id: 'appt-5',
    tenantId: 'tenant-dom-pedro',
    serviceId: 'srv-corte-dp',
    professionalId: 'prof-gustavo',
    customerId: 'cust-rodrigo',
    customerName: 'Rodrigo Mello',
    customerPhone: '(11) 97777-2222',
    date: '2026-05-30', // tomorrow
    time: '11:00',
    durationMinutes: 40,
    price: 60.00,
    status: 'confirmed'
  },

  // Studio Bella Donna
  {
    id: 'appt-6',
    tenantId: 'tenant-studio-bella',
    serviceId: 'srv-unhas-bd',
    professionalId: 'prof-mariana',
    customerId: 'cust-karla',
    customerName: 'Karla Albuquerque',
    customerPhone: '(11) 95555-4444',
    date: '2026-05-29',
    time: '11:00',
    durationMinutes: 60,
    price: 85.00,
    status: 'confirmed'
  },
  {
    id: 'appt-7',
    tenantId: 'tenant-studio-bella',
    serviceId: 'srv-escova-bd',
    professionalId: 'prof-ana',
    customerId: 'cust-juliana',
    customerName: 'Juliana Pires',
    customerPhone: '(11) 94444-5555',
    date: '2026-05-29',
    time: '15:30',
    durationMinutes: 45,
    price: 120.00,
    status: 'pending'
  }
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    tenantId: 'tenant-dom-pedro',
    appointmentId: 'appt-1',
    amount: 60.00,
    method: 'pix',
    status: 'paid',
    date: '2026-05-29 09:45:12',
    description: 'Faturamento de Agendamento - Thiago Alencar (Corte Premium)'
  },
  {
    id: 'pay-2',
    tenantId: 'tenant-dom-pedro',
    amount: 45.00,
    method: 'credit_card',
    status: 'paid',
    date: '2026-05-28 17:30:11',
    description: 'Venda de Produto Balcão - Pomada Modeladora Matte'
  },
  {
    id: 'pay-3',
    tenantId: 'tenant-dom-pedro',
    amount: 38.00,
    method: 'cash',
    status: 'paid',
    date: '2026-05-28 14:15:00',
    description: 'Venda de Produto Balcão - Óleo de Barba'
  },

  // Admin SaaS Subscription Payments
  {
    id: 'pay-saas-1',
    tenantId: 'tenant-dom-pedro',
    amount: 149.90,
    method: 'credit_card',
    status: 'paid',
    date: '2026-05-15 01:21:40',
    description: 'Assinatura SaaS - Plano Mensal (Barbearia Dom Pedro)'
  },
  {
    id: 'pay-saas-2',
    tenantId: 'tenant-lenox-barber',
    amount: 1199.00,
    method: 'pix',
    status: 'failed',
    date: '2026-05-15 00:00:00',
    description: 'Assinatura SaaS - Plano Anual Renovação Falhou (Lenox Premium)'
  }
];

export const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'cp-10off',
    code: 'BEMVINDO10',
    discountPercentage: 10,
    status: 'active',
    usageCount: 34,
    expiresAt: '2027-01-01'
  },
  {
    id: 'cp-black',
    code: 'BLACKSAAS25',
    discountPercentage: 25,
    status: 'active',
    usageCount: 8,
    expiresAt: '2026-11-30'
  },
  {
    id: 'cp-exp',
    code: 'EXPIRED50',
    discountPercentage: 50,
    status: 'expired',
    usageCount: 140,
    expiresAt: '2026-04-01'
  }
];

export const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 'ticket-1',
    tenantId: 'tenant-dom-pedro',
    tenantName: 'Barbearia Dom Pedro',
    title: 'Erro na configuração do Pixel de conversão',
    status: 'open',
    createdAt: '2026-05-28 14:00',
    messages: [
      {
        sender: 'tenant',
        content: 'Olá pessoal, cadastrei o código do pixel do facebook nas configurações, mas não estou detectando os eventos de agendamento na página final. Conseguem me ajudar?',
        timestamp: '2026-05-28 14:02'
      },
      {
        sender: 'system',
        content: 'Chamado aberto com status Pendente. Direcionado ao time de suporte técnico.',
        timestamp: '2026-05-28 14:02'
      }
    ]
  },
  {
    id: 'ticket-2',
    tenantId: 'tenant-studio-bella',
    tenantName: 'Studio Bella Donna',
    title: 'Dúvida sobre o repasse automático de comissões',
    status: 'resolved',
    createdAt: '2026-05-24 10:15',
    messages: [
      {
        sender: 'tenant',
        content: 'Consigo ratear comissões entre profissionais associados em combos? Por exemplo, corte de cabelo para um e barba para outro professional na mesma comissão de combo?',
        timestamp: '2026-05-24 10:15'
      },
      {
        sender: 'superadmin',
        content: 'Sim, na aba de faturamento de comissões corporativas, você pode dividir a quota do combo informando o percentual de comissão individual por profissional. Resolvido!',
        timestamp: '2026-05-24 16:30'
      },
      {
        sender: 'tenant',
        content: 'Excelente! Entendi perfeitamente. Muito obrigada pela ajuda rápida.',
        timestamp: '2026-05-25 09:12'
      }
    ]
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-05-29 18:41:02',
    ip: '192.168.1.45',
    userId: 'super-usr-1',
    userName: 'Super Admin Principal',
    tenantId: null,
    action: 'Bloqueio de Tenant',
    details: 'Tenant [tenant-lenox-barber] marcado como bloqueado por inadimplência automática.'
  },
  {
    id: 'log-2',
    timestamp: '2026-05-29 16:20:11',
    ip: '177.34.89.212',
    userId: 'usr-dp-admin',
    userName: 'Gerente Dom Pedro',
    tenantId: 'tenant-dom-pedro',
    action: 'Atualização de Estoque',
    details: 'Produto [prod-oleo] teve alteração manual de estoque de 5 para 3 unidades.'
  },
  {
    id: 'log-3',
    timestamp: '2026-05-29 14:05:40',
    ip: '189.12.98.54',
    userId: 'end-customer-anonymous',
    userName: 'Diego Fernandes (Cliente)',
    tenantId: 'tenant-dom-pedro',
    action: 'Criação de Agendamento',
    details: 'Cliente agendou [srv-combo-dp] com [prof-felipe] para 2026-05-29 às 14:00.'
  },
  {
    id: 'log-4',
    timestamp: '2026-05-28 22:11:00',
    ip: '192.168.1.45',
    userId: 'super-usr-1',
    userName: 'Super Admin Principal',
    tenantId: null,
    action: 'Cadastro de Cupom',
    details: 'Novo cupom de desconto BLACKSAAS25 (25%) cadastrado com sucesso.'
  }
];
