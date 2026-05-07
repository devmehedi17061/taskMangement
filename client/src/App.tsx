import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, setOnUnauthorized } from './api/client';
import { AuthContext, type AuthContextValue } from './hooks/useAuth';
import type { OwnerStatus, User } from './lib/types';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TasksPage } from './pages/TasksPage';

function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [owner, setOwner] = useState<OwnerStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.me();
      setUser(data?.user ?? null);
      setOwner(data?.owner ?? { connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setOwner({ connected: false });
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setOwner({ connected: false });
      navigate('/login', { replace: true });
    });
    return () => setOnUnauthorized(null);
  }, [navigate]);

  const value: AuthContextValue = { user, owner, loading, refresh, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="projects" replace />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<TasksPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
