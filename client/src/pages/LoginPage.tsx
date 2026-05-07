import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthForm } from '../components/AuthForm';

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-8">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-accent text-white">
          <FolderKanban size={22} />
        </div>
        <h1 className="text-xl font-semibold text-ink">Drive Projects</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in or create an account.</p>
        <div className="mt-6">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
