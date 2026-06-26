// src/components/guards/RouteGuard.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  roles: Role[];
  redirectTo?: string;
}

export function RouteGuard({ children, roles, redirectTo = '/login' }: Props) {
  const { profile, loading, session } = useAuth();

  // Mostra spinner enquanto carrega OU enquanto há sessão mas o profile ainda não chegou
  if (loading || (session && !profile)) {
    return (
      <div style={{ minHeight: '100vh', background: `url(https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2025%20de%20jun.%20de%202026,%2016_12_48.png) center/cover no-repeat`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, fontFamily: 'Outfit, sans-serif' }}>
        <style>{`
          @keyframes wlFadeIn { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
          @keyframes wlShimmer { 0% { transform:translateX(-100%) } 100% { transform:translateX(200%) } }
          @keyframes wlBounce0 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
          @keyframes wlBounce1 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
          @keyframes wlBounce2 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        `}</style>
        <img
          src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png"
          alt="WorkAgenda"
          style={{ height: 140, objectFit: 'contain', animation: 'wlFadeIn 0.6s ease-out both' }}
        />
        <div style={{ position: 'relative', width: 200, height: 3, background: '#DBEAFE', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,#2563EB,transparent)', animation: 'wlShimmer 1.4s ease-in-out infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(n => (
            <div key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', opacity: 0.7, animation: `wlBounce${n} 1.2s ease-in-out ${n * 0.18}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
