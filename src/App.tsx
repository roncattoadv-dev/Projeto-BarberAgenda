// src/App.tsx — Router principal
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouteGuard } from './components/guards/RouteGuard';
import LandingPage       from './pages/LandingPage';
import LoginPage         from './pages/auth/LoginPage';
import RegisterPage      from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import SuperAdminPage  from './pages/admin/SuperAdminPage';
import TenantAdminPage from './pages/admin/TenantAdminPage';
import BookingPage     from './pages/booking/BookingPage';
import CancelPage      from './pages/booking/CancelPage';

// Redireciona para o painel correto se autenticado, senão mostra a landing page
function HomeRoute() {
  const { profile, loading, needsOnboarding } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <img src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png" alt="WorkAgenda" style={{ height: 120, objectFit: 'contain' }} />
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #BFDBFE', borderTopColor: '#2563EB', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (needsOnboarding)                  return <Navigate to="/cadastro"    replace />;
  if (profile?.role === 'super_admin')  return <Navigate to="/admin/super"  replace />;
  if (profile?.role === 'tenant_admin') return <Navigate to="/admin/painel" replace />;
  return <LandingPage />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Raiz ──────────────────────────────────── */}
      <Route path="/" element={<HomeRoute />} />

      {/* ── Auth ──────────────────────────────────── */}
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/cadastro"         element={<RegisterPage />} />
      <Route path="/redefinir-senha"  element={<ResetPasswordPage />} />

      {/* ── Super Admin ───────────────────────────── */}
      <Route path="/admin/super" element={
        <RouteGuard roles={['super_admin']}>
          <SuperAdminPage />
        </RouteGuard>
      } />

      {/* ── Tenant Admin ──────────────────────────── */}
      <Route path="/admin/painel" element={
        <RouteGuard roles={['tenant_admin', 'tenant_professional']}>
          <TenantAdminPage />
        </RouteGuard>
      } />

      {/* ── Agendamento público por slug ───────────── */}
      {/* ex: /barbeariaespacoreal/agendamento         */}
      <Route path="/:slug/agendamento" element={<BookingPage />} />

      {/* ── Cancelamento de agendamento ────────────── */}
      {/* ex: /barbeariaespacoreal/cancelar/UUID        */}
      <Route path="/:slug/cancelar/:appointmentId" element={<CancelPage />} />

      {/* ── 404 ───────────────────────────────────── */}
      <Route path="*" element={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <p className="text-4xl mb-4">404</p>
            <p className="text-sm">Página não encontrada.</p>
          </div>
        </div>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
