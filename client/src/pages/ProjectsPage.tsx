import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Plus } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Project } from '../lib/types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { ProjectCard } from '../components/ProjectCard';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';

export function ProjectsPage() {
  const { owner, refresh: refreshAuth } = useAuth();
  const [params, setParams] = useSearchParams();
  const gerror = params.get('gerror');
  const gconnected = params.get('gconnected');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (gconnected) {
      void refreshAuth();
      const next = new URLSearchParams(params);
      next.delete('gconnected');
      setParams(next, { replace: true });
    }
  }, [gconnected, params, refreshAuth, setParams]);

  function closeNew() {
    if (creating) return;
    setShowNew(false);
    setNewTitle('');
    setNewAssignedTo('');
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setCreateError(null);
    try {
      await api.createProject({ title, assignedTo: newAssignedTo.trim() });
      closeNew();
      await reload();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(project: Project) {
    if (
      !window.confirm(
        `Delete "${project.title}"? Its Drive folder will be moved to Trash (recoverable for 30 days).`,
      )
    ) {
      return;
    }
    setDeletingId(project.id);
    try {
      await api.deleteProject(project.id);
      await reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Projects</h1>
          <p className="text-sm text-slate-500">
            Each project gets a folder in Drive with a Tasks Sheet and a Notes Doc.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} disabled={!owner.connected}>
          <Plus size={14} /> New Project
        </Button>
      </div>

      {gerror && (
        <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Google connection error: {gerror}
        </div>
      )}

      {!owner.connected && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-900">Connect Google Drive to create projects</p>
            <p className="mt-0.5 text-xs text-amber-800">
              The app uses your Google account to create the per-project folder, Tasks Sheet, and Notes Doc.
              Your account's storage quota is used (15 GB on a personal account).
            </p>
          </div>
          <a
            href={api.connectGoogleUrl()}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Connect Google Drive
          </a>
        </div>
      )}

      {owner.connected && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 size={14} /> Google Drive connected as {owner.email ?? 'unknown'}.
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Spinner size={28} />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      {!loading && !error && (
        <>
          {projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              No projects yet. Create your first one.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onDelete={handleDelete}
                  deleting={deletingId === p.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={showNew}
        onClose={closeNew}
        title="New Project"
        footer={
          <>
            <Button variant="secondary" onClick={closeNew} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                void handleCreate(e as unknown as React.FormEvent);
              }}
              loading={creating}
              disabled={!newTitle.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="project-title">
              Project title
            </label>
            <input
              id="project-title"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Marketing Site Launch"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              disabled={creating}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="project-assignee">
              Assigned to
            </label>
            <input
              id="project-assignee"
              value={newAssignedTo}
              onChange={(e) => setNewAssignedTo(e.target.value)}
              placeholder="email or name (optional)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              disabled={creating}
            />
          </div>
          {createError && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{createError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
