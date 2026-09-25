import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import type { AuthUser } from './api';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: AuthUser['role'][];
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading">Checking your session...</div>;
  if (!user) return null;
  if (roles && !roles.includes(user.role))
    return <div className="auth-loading">Access restricted.</div>;
  return children;
}
