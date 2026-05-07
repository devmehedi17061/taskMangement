import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Button } from './Button';

type Mode = 'login' | 'register';

export function AuthForm() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await api.register({ name: name.trim(), email: email.trim(), password });
      } else {
        await api.login({ email: email.trim(), password });
      }
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent';

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 text-sm">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`py-2 font-medium ${
            mode === 'login' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`py-2 font-medium ${
            mode === 'register' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        {mode === 'register' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="auth-name">
              Name
            </label>
            <input
              id="auth-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              maxLength={80}
              className={inputClass}
              disabled={submitting}
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={inputClass}
            disabled={submitting}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
            className={inputClass}
            disabled={submitting}
          />
          {mode === 'register' && (
            <p className="mt-1 text-[11px] text-slate-400">At least 8 characters.</p>
          )}
        </div>
        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}
        <Button type="submit" loading={submitting} className="w-full justify-center">
          {mode === 'register' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
