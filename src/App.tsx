// src/App.tsx — Router principal
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouteGuard } from './components/guards/RouteGuard';
import LoginPage       from './pages/auth/LoginPage';
import SuperAdminPage  from './pages/admin/SuperAdminPage';
import TenantAdminPage from './pages/admin/TenantAdminPage';
import BookingPage     from './pages/booking/BookingPage';

// Redireciona para o painel correto após login
function HomeRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role === 'super_admin')  return <Navigate to="/admin/super"  replace />;
  if (profile.role === 'tenant_admin') return <Navigate to="/admin/painel" replace />;
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Raiz ──────────────────────────────────── */}
      <Route path="/" element={<HomeRedirect />} />

      {/* ── Auth ──────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />

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
