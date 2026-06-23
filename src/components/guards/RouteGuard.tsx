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
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <img src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png" alt="WorkAgenda" style={{ height: 120, objectFit: 'contain' }} />
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #BFDBFE', borderTopColor: '#2563EB', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
