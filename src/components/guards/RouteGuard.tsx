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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
