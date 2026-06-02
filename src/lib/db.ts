// src/lib/db.ts
// Todas as queries ao Supabase — substitui src/data.ts em produção
import { supabase } from './supabase';
import type {
  Tenant, Service, Professional, Customer,
  Appointment, Payment, Product, Coupon, AuditLog, SupportTicket,
} from '../types';

// ── helpers ────────────────────────────────────────────────────────────────────
function tenantFilter<T extends { tenantId?: string; tenant_id?: string }>(items: T[], tenantId: string) {
  return items.filter(i => (i as any).tenant_id === tenantId || i.tenantId === tenantId);
}

// ── TENANTS ────────────────────────────────────────────────────────────────────
export async function getTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTenant);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await supabase.from('tenants').select('*').eq('slug', slug).single();
  if (error) return null;
  return mapTenant(data);
}

export async function updateTenant(id: string, payload: Partial<Tenant>) {
  const { error } = await supabase.from('tenants').update(dbTenant(payload)).eq('id', id);
  if (error) throw error;
}

// ── SERVICES ───────────────────────────────────────────────────────────────────
export async function getServices(tenantId: string): Promise<Service[]> {
  const { data, error } = await supabase.from('services')
    .select('*').eq('tenant_id', tenantId).eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []).map(mapService);
}

export async function createService(s: Omit<Service, 'id'>): Promise<Service> {
  const { data, error } = await supabase.from('services').insert(dbService(s)).select().single();
  if (error) throw error;
  return mapService(data);
}

// ── PROFESSIONALS ──────────────────────────────────────────────────────────────
export async function getProfessionals(tenantId: string): Promise<Professional[]> {
  const { data, error } = await supabase.from('professionals')
    .select('*, professional_services(service_id)')
    .eq('tenant_id', tenantId).eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []).map(p => ({
    ...mapProfessional(p),
    services: (p.professional_services ?? []).map((ps: any) => ps.service_id),
  }));
}

export async function createProfessional(p: Omit<Professional, 'id'>, serviceIds: string[]): Promise<Professional> {
  const { data, error } = await supabase.from('professionals').insert(dbProfessional(p)).select().single();
  if (error) throw error;
  if (serviceIds.length) {
    await supabase.from('professional_services').insert(
      serviceIds.map(sid => ({ professional_id: data.id, service_id: sid }))
    );
  }
  return { ...mapProfessional(data), services: serviceIds };
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────────────
export async function getCustomers(tenantId: string): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers')
    .select('*').eq('tenant_id', tenantId).order('name');
  if (error) throw error;
  return (data ?? []).map(mapCustomer);
}

export async function upsertCustomerByPhone(tenantId: string, phone: string, name: string, email?: string): Promise<Customer> {
  const { data: existing } = await supabase.from('customers')
    .select('*').eq('tenant_id', tenantId).eq('phone', phone).maybeSingle();
  if (existing) return mapCustomer(existing);
  const { data, error } = await supabase.from('customers')
    .insert({ tenant_id: tenantId, name, phone, email: email ?? null }).select().single();
  if (error) throw error;
  return mapCustomer(data);
}

// ── APPOINTMENTS ───────────────────────────────────────────────────────────────
export async function getAppointments(tenantId: string, limit = 200): Promise<Appointment[]> {
  const { data, error } = await supabase.from('appointments')
    .select('*').eq('tenant_id', tenantId)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapAppointment);
}

export async function getOccupiedSlots(professionalId: string, date: string): Promise<string[]> {
  const { data } = await supabase.from('appointments')
    .select('scheduled_time').eq('professional_id', professionalId)
    .eq('scheduled_date', date).neq('status', 'cancelled');
  return (data ?? []).map(a => a.scheduled_time.substring(0, 5));
}

export async function createAppointment(a: Omit<Appointment, 'id'>): Promise<Appointment> {
  const { data, error } = await supabase.from('appointments').insert(dbAppointment(a)).select().single();
  if (error) throw error;
  return mapAppointment(data);
}

export async function notifyAppointmentWhatsApp(tenantId: string, appointmentId: string, token: string): Promise<void> {
  const apiUrl = ((window as any).__BARBER_CONFIG__?.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
  await fetch(`${apiUrl}/api/whatsapp/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ tenantId, appointmentId }),
  });
}

export async function updateAppointmentStatus(id: string, status: Appointment['status']) {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) throw error;
}

// ── PAYMENTS ───────────────────────────────────────────────────────────────────
export async function getPayments(tenantId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments')
    .select('*').eq('tenant_id', tenantId).order('paid_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPayment);
}

export async function createPayment(p: Omit<Payment, 'id'>): Promise<Payment> {
  const { data, error } = await supabase.from('payments').insert(dbPayment(p)).select().single();
  if (error) throw error;
  return mapPayment(data);
}

// ── PRODUCTS ───────────────────────────────────────────────────────────────────
export async function getProducts(tenantId: string): Promise<Product[]> {
  const { data, error } = await supabase.from('products')
    .select('*').eq('tenant_id', tenantId).eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function createProduct(p: Omit<Product, 'id'>): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(dbProduct(p)).select().single();
  if (error) throw error;
  return mapProduct(data);
}

export async function updateProductStock(id: string, stock: number) {
  const { error } = await supabase.from('products').update({ stock }).eq('id', id);
  if (error) throw error;
}

// ── AUDIT LOG ──────────────────────────────────────────────────────────────────
export async function logAudit(action: string, details: string, tenantId: string | null, userName: string, userId?: string) {
  await supabase.from('audit_logs').insert({ action, details, tenant_id: tenantId, user_name: userName, user_id: userId ?? null, ip: null });
}

export async function getAuditLogs(tenantId: string | null, limit = 100): Promise<AuditLog[]> {
  let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapAuditLog);
}

// ── COUPONS ────────────────────────────────────────────────────────────────────
export async function getCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCoupon);
}

export async function createCoupon(c: Omit<Coupon, 'id'>): Promise<Coupon> {
  const { data, error } = await supabase.from('coupons').insert({
    code: c.code, discount_percentage: c.discountPercentage,
    status: c.status, expires_at: c.expiresAt, usage_count: 0,
  }).select().single();
  if (error) throw error;
  return mapCoupon(data);
}

// ── MAPPERS (snake_case DB → camelCase App) ────────────────────────────────────
function mapTenant(r: any): Tenant {
  return {
    id: r.id, name: r.name, slug: r.slug, logo: r.logo ?? '💈',
    banner: r.banner ?? '', phone: r.phone, address: r.address,
    instagram: r.instagram ?? '', status: r.status, plan: r.plan,
    trialEndsAt: r.trial_ends_at, subscriptionEndsAt: r.subscription_ends_at ?? '',
    mrr: Number(r.mrr ?? 0),
    businessHours: r.business_hours ?? [],
    businessDays: r.business_days ?? [],
    businessHoursByDay: r.business_hours_by_day ?? {},
  };
}
function mapService(r: any): Service {
  return { id: r.id, tenantId: r.tenant_id, name: r.name, durationMinutes: r.duration_minutes, price: Number(r.price), category: r.category, description: r.description };
}
function mapProfessional(r: any): Professional {
  return { id: r.id, tenantId: r.tenant_id, name: r.name, role: r.role, avatar: r.avatar ?? '', rating: Number(r.rating ?? 5), services: [], commissionPercentage: Number(r.commission_percentage ?? 40), businessDays: r.business_days ?? [], businessHoursByDay: r.business_hours_by_day ?? {} };
}
function mapCustomer(r: any): Customer {
  return { id: r.id, tenantId: r.tenant_id, name: r.name, email: r.email ?? '', phone: r.phone, notes: r.notes, createdAt: r.created_at };
}
function mapAppointment(r: any): Appointment {
  return { id: r.id, tenantId: r.tenant_id, serviceId: r.service_id, professionalId: r.professional_id, customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone, date: r.scheduled_date, time: r.scheduled_time?.substring(0,5) ?? '', durationMinutes: r.duration_minutes, price: Number(r.price), status: r.status, notes: r.notes };
}
function mapPayment(r: any): Payment {
  return { id: r.id, tenantId: r.tenant_id, appointmentId: r.appointment_id, amount: Number(r.amount), method: r.method, status: r.status, date: r.paid_at, description: r.description ?? '' };
}
function mapProduct(r: any): Product {
  return { id: r.id, tenantId: r.tenant_id, name: r.name, price: Number(r.price), costPrice: Number(r.cost_price ?? 0), stock: r.stock, minStock: r.min_stock, category: r.category };
}
function mapAuditLog(r: any): AuditLog {
  return { id: r.id, timestamp: r.created_at, ip: r.ip ?? '', userId: r.user_id ?? '', userName: r.user_name, tenantId: r.tenant_id, action: r.action, details: r.details };
}
function mapCoupon(r: any): Coupon {
  return { id: r.id, code: r.code, discountPercentage: r.discount_percentage, status: r.status, usageCount: r.usage_count, expiresAt: r.expires_at };
}

// ── REVERSE MAPPERS (camelCase → snake_case for INSERT) ────────────────────────
function dbTenant(t: Partial<Tenant>): any {
  return {
    ...(t.name       !== undefined && { name: t.name }),
    ...(t.logo       !== undefined && { logo: t.logo }),
    ...(t.phone      !== undefined && { phone: t.phone }),
    ...(t.address    !== undefined && { address: t.address }),
    ...(t.instagram  !== undefined && { instagram: t.instagram }),
    ...(t.status     !== undefined && { status: t.status }),
    ...(t.plan       !== undefined && { plan: t.plan }),
    ...(t.mrr        !== undefined && { mrr: t.mrr }),
    ...(t.businessDays      !== undefined && { business_days: t.businessDays }),
    ...(t.businessHours     !== undefined && { business_hours: t.businessHours }),
    ...(t.businessHoursByDay !== undefined && { business_hours_by_day: t.businessHoursByDay }),
  };
}
function dbService(s: Omit<Service, 'id'>): any {
  return { tenant_id: s.tenantId, name: s.name, duration_minutes: s.durationMinutes, price: s.price, category: s.category, description: s.description ?? null, is_active: true };
}
function dbProfessional(p: Omit<Professional, 'id'>): any {
  return { tenant_id: p.tenantId, name: p.name, role: p.role, avatar: p.avatar ?? null, rating: p.rating, commission_percentage: p.commissionPercentage, business_days: p.businessDays ?? [], business_hours_by_day: p.businessHoursByDay ?? {}, is_active: true };
}
function dbAppointment(a: Omit<Appointment, 'id'>): any {
  return { tenant_id: a.tenantId, service_id: a.serviceId, professional_id: a.professionalId, customer_id: a.customerId, customer_name: a.customerName, customer_phone: a.customerPhone, scheduled_date: a.date, scheduled_time: a.time, duration_minutes: a.durationMinutes, price: a.price, status: a.status, notes: a.notes ?? null };
}
function dbPayment(p: Omit<Payment, 'id'>): any {
  return { tenant_id: p.tenantId, appointment_id: p.appointmentId ?? null, amount: p.amount, method: p.method, status: p.status, description: p.description };
}
function dbProduct(p: Omit<Product, 'id'>): any {
  return { tenant_id: p.tenantId, name: p.name, price: p.price, cost_price: p.costPrice, stock: p.stock, min_stock: p.minStock, category: p.category, is_active: true };
}
