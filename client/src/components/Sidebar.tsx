import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  FolderOpen,
  Loader2,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Project } from '../lib/types';
import { useAuth } from '../hooks/useAuth';

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await api.listProjects();
        if (!cancelled) setProjects(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load projects');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const localPart = (user?.email ?? '?').split('@')[0] ?? '?';
  const initials =
    localPart
      .split(/[._-]/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('') || '?';

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-ink shadow-card md:hidden"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={[
          'flex flex-col border-r border-slate-200 bg-white transition-[width] duration-200',
          'fixed inset-y-0 left-0 z-40 md:static md:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'w-16' : 'w-64',
        ].join(' ')}
      >
        <div
          className={`flex items-center gap-2 border-b border-slate-200 px-3 py-3 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <NavLink to="/projects" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-white">
              <FolderKanban size={16} />
            </span>
            {!collapsed && <span className="truncate text-sm font-semibold text-ink">Drive Projects</span>}
          </NavLink>
          {!collapsed && (
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-ink md:hidden"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="px-2 pt-3">
          <NavLink
            to="/projects"
            end
            className={({ isActive }) => navItemClasses(isActive, collapsed)}
            title="All Projects"
          >
            <FolderKanban size={16} />
            {!collapsed && <span>All Projects</span>}
            {!collapsed && (
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {projects.length}
              </span>
            )}
          </NavLink>
        </nav>

        <div className={`mt-3 px-4 ${collapsed ? 'hidden' : ''}`}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Projects</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading && (
            <div className="flex items-center justify-center py-4 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}

          {!loading && error && !collapsed && (
            <p className="px-3 py-2 text-xs text-rose-600">{error}</p>
          )}

          {!loading && !error && projects.length === 0 && !collapsed && (
            <p className="px-3 py-2 text-xs text-slate-400">No projects yet.</p>
          )}

          <ul className="space-y-0.5">
            {projects.map((p) => (
              <li key={p.id}>
                <NavLink
                  to={`/projects/${p.id}`}
                  title={p.title}
                  className={({ isActive }) => navItemClasses(isActive, collapsed)}
                >
                  <FolderOpen size={16} className="shrink-0" />
                  {!collapsed && <span className="truncate">{p.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-slate-200 p-3">
          {user && (
            <div className={`mb-2 flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-ink">
                {initials}
              </span>
              {!collapsed && (
                <span className="truncate text-xs text-slate-600" title={user.email}>
                  {user.email}
                </span>
              )}
            </div>
          )}
          <div className={`flex gap-1 ${collapsed ? 'flex-col' : ''}`}>
            {user && (
              <button
                type="button"
                onClick={() => void logout()}
                title="Logout"
                className={`inline-flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-slate-50 ${
                  collapsed ? 'justify-center px-0' : ''
                }`}
              >
                <LogOut size={14} />
                {!collapsed && <span>Logout</span>}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-ink md:inline-flex"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function navItemClasses(isActive: boolean, collapsed: boolean): string {
  return [
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition',
    collapsed ? 'justify-center' : '',
    isActive
      ? 'bg-blue-50 text-accent'
      : 'text-slate-600 hover:bg-slate-100 hover:text-ink',
  ].join(' ');
}
