// src/App.tsx — Router principal
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouteGuard } from './components/guards/RouteGuard';
import LandingPage       from './pages/LandingPage';
import LoginPage         from './pages/auth/LoginPage';
import RegisterPage      from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import GoogleCallbackPage from './pages/auth/GoogleCallbackPage';
import SuperAdminPage  from './pages/admin/SuperAdminPage';
import TenantAdminPage from './pages/admin/TenantAdminPage';
import BookingPage     from './pages/booking/BookingPage';
import CancelPage      from './pages/booking/CancelPage';

// Redireciona para o painel correto se autenticado, senão mostra a landing page
function HomeRoute() {
  const { profile, loading, needsOnboarding } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#F8FAFC 0%,#EFF6FF 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, fontFamily: 'Outfit, sans-serif' }}>
      <style>{`
        @keyframes wlFadeIn { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
        @keyframes wlShimmer { 0% { transform:translateX(-100%) } 100% { transform:translateX(200%) } }
        @keyframes wlBounce0 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes wlBounce1 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes wlBounce2 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
      `}</style>

      {/* Logo com fade-in */}
      <img
        src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png"
        alt="WorkAgenda"
        style={{ height: 140, objectFit: 'contain', animation: 'wlFadeIn 0.6s ease-out both' }}
      />

      {/* Barra de progresso com shimmer */}
      <div style={{ position: 'relative', width: 200, height: 3, background: '#DBEAFE', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,#2563EB,transparent)', animation: 'wlShimmer 1.4s ease-in-out infinite' }} />
      </div>

      {/* Dots pulsantes */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(n => (
          <div key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', opacity: 0.7, animation: `wlBounce${n} 1.2s ease-in-out ${n * 0.18}s infinite` }} />
        ))}
      </div>
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
      <Route path="/landing" element={<LandingPage />} />

      {/* ── Auth ──────────────────────────────────── */}
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/cadastro"         element={<RegisterPage />} />
      <Route path="/redefinir-senha"  element={<ResetPasswordPage />} />
      <Route path="/auth/callback"    element={<GoogleCallbackPage />} />

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
