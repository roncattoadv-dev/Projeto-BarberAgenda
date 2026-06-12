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
  const { data, error } = await supabase.from('tenants').select('*').neq('slug', 'platform').order('created_at', { ascending: false });
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

export async function updateService(id: string, s: Partial<Omit<Service, 'id'>>): Promise<void> {
  const payload: any = {};
  if (s.name         !== undefined) payload.name             = s.name;
  if (s.price        !== undefined) payload.price            = s.price;
  if (s.durationMinutes !== undefined) payload.duration_minutes = s.durationMinutes;
  if (s.category     !== undefined) payload.category         = s.category;
  const { error } = await supabase.from('services').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteService(id: string): Promise<void> {
  // Soft-delete: marca is_active = false para preservar histórico de agendamentos
  const { error } = await supabase.from('services').update({ is_active: false }).eq('id', id);
  if (error) throw error;
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

export async function deleteProfessional(id: string): Promise<void> {
  const { error } = await supabase.from('professionals').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function updateProfessional(id: string, p: Partial<Omit<Professional, 'id' | 'tenantId'>>): Promise<void> {
  const updates: any = {};
  if (p.name               !== undefined) updates.name                = p.name;
  if (p.role               !== undefined) updates.role                = p.role;
  if (p.avatar             !== undefined) updates.avatar              = p.avatar;
  if (p.commissionPercentage !== undefined) updates.commission_percentage = p.commissionPercentage;
  if (p.businessDays       !== undefined) updates.business_days       = p.businessDays;
  if (p.businessHoursByDay !== undefined) updates.business_hours_by_day = p.businessHoursByDay;
  if (Object.keys(updates).length) {
    const { error } = await supabase.from('professionals').update(updates).eq('id', id);
    if (error) throw error;
  }
}

export async function syncProfessionalsHours(tenantId: string, businessDays: string[], businessHoursByDay: Record<string, string[]>): Promise<void> {
  await supabase.from('professionals')
    .update({ business_days: businessDays, business_hours_by_day: businessHoursByDay })
    .eq('tenant_id', tenantId);
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────────────
export async function getCustomers(tenantId: string): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers')
    .select('*').eq('tenant_id', tenantId).order('name');
  if (error) throw error;
  return (data ?? []).map(mapCustomer);
}

export async function updateCustomer(id: string, updates: { name?: string; phone?: string; email?: string; notes?: string }): Promise<void> {
  const { error } = await supabase.from('customers').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error: apptError } = await supabase.from('appointments').delete().eq('customer_id', id);
  if (apptError) throw apptError;
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertCustomerByPhone(tenantId: string, phone: string, name: string, email?: string): Promise<Customer> {
  const { data, error } = await supabase.rpc('upsert_customer', {
    p_tenant_id: tenantId,
    p_phone:     phone,
    p_name:      name,
    p_email:     email ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('upsert_customer retornou vazio');
  return mapCustomer(row);
}

export async function createCustomerDirect(tenantId: string, name: string, phone?: string, email?: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ tenant_id: tenantId, name, phone: phone || '', email: email || '' })
    .select()
    .single();
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

export async function getOccupiedSlots(professionalId: string, date: string): Promise<{time: string; duration: number}[]> {
  const { data } = await supabase.from('appointments')
    .select('scheduled_time, duration_minutes').eq('professional_id', professionalId)
    .eq('scheduled_date', date).neq('status', 'cancelled');
  return (data ?? []).map(a => ({ time: a.scheduled_time.substring(0, 5), duration: a.duration_minutes ?? 60 }));
}

export async function createAppointment(a: Omit<Appointment, 'id'>): Promise<Appointment> {
  const { data, error } = await supabase.from('appointments').insert(dbAppointment(a)).select().single();
  if (error) throw error;
  return mapAppointment(data);
}

export async function notifyAppointmentWhatsApp(tenantId: string, appointmentId: string, _token?: string): Promise<void> {
  const apiUrl = ((window as any).__BARBER_CONFIG__?.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
  await fetch(`${apiUrl}/api/whatsapp/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, appointmentId }),
  });
}

export async function remindAppointmentWhatsApp(tenantId: string, appointmentId: string): Promise<void> {
  const apiUrl = ((window as any).__BARBER_CONFIG__?.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
  const res = await fetch(`${apiUrl}/api/whatsapp/remind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, appointmentId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateAppointmentStatus(id: string, status: Appointment['status']) {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function rescheduleAppointment(id: string, date: string, time: string): Promise<void> {
  const { error } = await supabase.from('appointments')
    .update({ scheduled_date: date, scheduled_time: time }).eq('id', id);
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

// ── TENANT LOGO STORAGE ────────────────────────────────────────────────────────
export async function uploadTenantLogo(tenantId: string, file: File): Promise<string> {
  const path = `${tenantId}/logo`;
  const { error } = await supabase.storage
    .from('tenant-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('tenant-logos').getPublicUrl(path);
  return data.publicUrl;
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
    blockedDates: r.blocked_dates ?? [],
    bookingPageConfig: r.booking_page_config ?? undefined,
    contactEmail: r.contact_email ?? undefined,
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
  return { id: r.id, tenantId: r.tenant_id, serviceId: r.service_id, professionalId: r.professional_id, customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone, customerEmail: r.customer_email ?? '', date: r.scheduled_date, time: r.scheduled_time?.substring(0,5) ?? '', durationMinutes: r.duration_minutes, price: Number(r.price), status: r.status, notes: r.notes, wppConfirmSent: r.wpp_confirm_sent ?? false, wppReminderSent: r.wpp_reminder_sent ?? false, emailConfirmSent: r.email_confirm_sent ?? false };
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
function mapSupportTicket(r: any): SupportTicket {
  return { id: r.id, tenantId: r.tenant_id, tenantName: r.tenant_name, title: r.title, status: r.status, createdAt: r.created_at, messages: r.messages ?? [] };
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
    ...(t.blockedDates        !== undefined && { blocked_dates: t.blockedDates }),
    ...(t.bookingPageConfig   !== undefined && { booking_page_config: t.bookingPageConfig }),
    ...(t.contactEmail        !== undefined && { contact_email: t.contactEmail }),
  };
}
function dbService(s: Omit<Service, 'id'>): any {
  return { tenant_id: s.tenantId, name: s.name, duration_minutes: s.durationMinutes, price: s.price, category: s.category, description: s.description ?? null, is_active: true };
}
function dbProfessional(p: Omit<Professional, 'id'>): any {
  return { tenant_id: p.tenantId, name: p.name, role: p.role, avatar: p.avatar ?? null, rating: p.rating, commission_percentage: p.commissionPercentage, business_days: p.businessDays ?? [], business_hours_by_day: p.businessHoursByDay ?? {}, is_active: true };
}
function dbAppointment(a: Omit<Appointment, 'id'>): any {
  return { tenant_id: a.tenantId, service_id: a.serviceId, professional_id: a.professionalId, customer_id: a.customerId, customer_name: a.customerName, customer_phone: a.customerPhone, customer_email: a.customerEmail ?? null, scheduled_date: a.date, scheduled_time: a.time, duration_minutes: a.durationMinutes, price: a.price, status: a.status, notes: a.notes ?? null };
}
function dbPayment(p: Omit<Payment, 'id'>): any {
  return { tenant_id: p.tenantId, appointment_id: p.appointmentId ?? null, amount: p.amount, method: p.method, status: p.status, description: p.description };
}
function dbProduct(p: Omit<Product, 'id'>): any {
  return { tenant_id: p.tenantId, name: p.name, price: p.price, cost_price: p.costPrice, stock: p.stock, min_stock: p.minStock, category: p.category, is_active: true };
}

// ── SUPPORT TICKETS ────────────────────────────────────────────────────────────

export async function getSupportTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSupportTicket);
}

export async function createSupportTicket(tenantId: string, tenantName: string, title: string, message: string): Promise<SupportTicket> {
  const firstMsg = { sender: 'tenant', content: message, timestamp: new Date().toISOString() };
  const { data, error } = await supabase.from('support_tickets')
    .insert({ tenant_id: tenantId, tenant_name: tenantName, title, messages: [firstMsg] })
    .select().single();
  if (error) throw error;
  return mapSupportTicket(data);
}

export async function resolveTicket(ticketId: string, replyMessage: string): Promise<void> {
  const { data: ticket, error: fetchErr } = await supabase
    .from('support_tickets').select('messages').eq('id', ticketId).single();
  if (fetchErr) throw fetchErr;
  const replyMsg = { sender: 'superadmin', content: replyMessage, timestamp: new Date().toISOString() };
  const { error } = await supabase.from('support_tickets')
    .update({ status: 'resolved', messages: [...(ticket.messages ?? []), replyMsg] })
    .eq('id', ticketId);
  if (error) throw error;
}
