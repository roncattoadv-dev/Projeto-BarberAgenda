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
  status: 'active' | 'blocked' | 'trial';
  plan: 'mensal' | 'semestral' | 'anual' | 'trial';
  trialEndsAt: string;
  subscriptionEndsAt: string;
  mrr: number;
  businessHours?: string[];
  businessDays?: string[]; // e.g. ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  businessHoursByDay?: Record<string, string[]>;
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
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended';
  notes?: string;
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
  plan: 'mensal' | 'semestral' | 'anual';
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

