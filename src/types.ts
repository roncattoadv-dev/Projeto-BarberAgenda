/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo: string;
  banner: string;
  phone: string;
  address: string;
  instagram: string;
  contactEmail?: string;
  status: 'active' | 'blocked' | 'trial';
  plan: 'mensal' | 'trimestral' | 'anual' | 'trial';
  trialEndsAt: string;
  subscriptionEndsAt: string;
  mrr: number;
  businessHours?: string[];
  businessDays?: string[];
  businessHoursByDay?: Record<string, string[]>;
  blockedDates?: string[]; // YYYY-MM-DD — férias, feriados, folgas
  agendaMode?: 'auto_complete' | 'auto_cancel' | 'manual';
  agendaTimeMinutes?: number;
  timezone?: string;
  reminderMinutes?: number;
  bookingPageConfig?: {
    primaryColor: string;
    showPhone: boolean;
    showAddress: boolean;
    showInstagram: boolean;
    mapsUrl?: string;
    waitlistEnabled?: boolean;
  };
}

export interface User {
  id: string;
  tenantId: string | null; // null for platform Super Admin
  name: string;
  email: string;
  role: 'super_admin' | 'tenant_admin' | 'tenant_professional' | 'customer';
  phone?: string;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  price: number;
  category: 'Cabelo' | 'Barba' | 'Estética' | 'Unhas' | 'Combo';
  description?: string;
}

export interface Professional {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  services: string[]; // Service IDs
  commissionPercentage: number;
  businessDays?: string[];
  businessHoursByDay?: Record<string, string[]>;
  blockedDates?: string[];
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  category: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  tenantId: string;
  serviceId: string;
  professionalId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended';
  notes?: string;
  wppConfirmSent?: boolean;
  wppReminderSent?: boolean;
  emailConfirmSent?: boolean;
}

export interface Payment {
  id: string;
  tenantId: string;
  appointmentId?: string;
  amount: number;
  method: 'pix' | 'credit_card' | 'cash';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  date: string; // YYYY-MM-DD HH:mm:ss
  description: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: 'mensal' | 'trimestral' | 'anual';
  amount: number;
  status: 'active' | 'past_due' | 'unpaid' | 'cancelled';
  gatewayId: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  ip: string;
  userId: string;
  userName: string;
  tenantId: string | null;
  action: string;
  details: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercentage: number;
  status: 'active' | 'expired';
  usageCount: number;
  expiresAt: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  tenantName: string;
  title: string;
  status: 'open' | 'resolved' | 'pending';
  createdAt: string;
  messages: {
    sender: 'system' | 'tenant' | 'superadmin';
    content: string;
    timestamp: string;
  }[];
}

export interface Review {
  id: string;
  tenantId: string;
  appointmentId: string;
  stars: number;
  comment?: string;
  createdAt: string;
}

export interface SlotHistory {
  id: string;
  tenantId: string;
  slotDate: string;       // YYYY-MM-DD
  slotTime: string;       // HH:MM
  professionalName: string | null;
  serviceName: string | null;
  cancelledCustomerName: string;
  cancelledCustomerPhone: string | null;
  filledCustomerName: string | null;
  filledCustomerPhone: string | null;
  filledAt: string | null;
  createdAt: string;
}

export interface RecurringExpense {
  id: string;
  tenantId: string;
  description: string;
  amount: number;
  frequency: 'semanal' | 'quinzenal' | 'mensal' | 'anual';
  nextDueDate: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  date: string;
  professionalId: string | null;
  timePreference: string;  // 'qualquer' ou 'HH:MM'
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

