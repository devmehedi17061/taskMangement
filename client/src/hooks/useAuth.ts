import { createContext, useContext } from 'react';
import type { OwnerStatus, User } from '../lib/types';

export interface AuthContextValue {
  user: User | null;
  owner: OwnerStatus;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
