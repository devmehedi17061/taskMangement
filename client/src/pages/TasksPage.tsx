import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileSpreadsheet, FileText, Plus, RefreshCcw } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Project, Step, Task, TaskInput, TaskStatus } from '../lib/types';
import { TASK_STATUSES } from '../lib/types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { RichTextEditor } from '../components/RichTextEditor';
import { Spinner } from '../components/Spinner';
import { TaskTable } from '../components/TaskTable';
import { StepsEditor } from '../components/steps/StepsEditor';
import { StepBlock } from '../components/steps/StepBlock';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:bg-slate-50';

function emptyForm(): TaskInput {
  return {
    title: '',
    description: '',
    steps: [],
    status: 'Todo',
    assignedTo: '',
  };
}

export function TasksPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id ?? '';

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<TaskInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [proj, taskList] = await Promise.all([
        api.getProject(projectId),
        api.listTasks(projectId),
      ]);
      setProject(proj);
      setTasks(taskList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setCreating(true);
  }

  function openEdit(task: Task) {
    setCreating(false);
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description,
      steps: task.steps ?? [],
      status: task.status,
      assignedTo: task.assignedTo,
    });
    setFormError(null);
  }

  function closeForm() {
    if (submitting) return;
    setCreating(false);
    setEditing(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Title is required');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await api.updateTask(projectId, editing.id, form);
      } else {
        await api.addTask(projectId, form);
      }
      closeForm();
      setEditing(null);
      setCreating(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    setPendingTaskId(task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await api.updateTask(projectId, task.id, { status });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update status');
      await reload();
    } finally {
      setPendingTaskId(null);
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    setPendingTaskId(task.id);
    try {
      await api.deleteTask(projectId, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete task');
      await reload();
    } finally {
      setPendingTaskId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/projects"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to projects
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{project?.title ?? 'Loading…'}</h1>
          <p className="text-sm text-slate-500">Tasks live in the project's Google Sheet.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {project && (
            <>
              <a
                href={project.sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" /> Open Sheet <ExternalLink size={12} />
              </a>
              <a
                href={project.docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                <FileText size={14} className="text-blue-600" /> Open Doc <ExternalLink size={12} />
              </a>
            </>
          )}
          <Button onClick={openCreate}>
            <Plus size={14} /> New Task
          </Button>
        </div>
      </div>

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
          <TaskTable
            tasks={tasks}
            onStatusChange={(t, s) => void changeStatus(t, s)}
            onEdit={openEdit}
            onDelete={(t) => void deleteTask(t)}
            pendingTaskId={pendingTaskId}
          />
          <TaskStepsList tasks={tasks} />
        </>
      )}

      {project && (
        <NotesPanel
          project={project}
          onRecreated={async (next) => {
            setProject(next);
            await reload();
          }}
        />
      )}

      <Modal
        open={creating || editing !== null}
        onClose={closeForm}
        title={editing ? `Edit ${editing.id}` : 'New Task'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={(e) => void submitForm(e as unknown as React.FormEvent)}
              loading={submitting}
              disabled={!form.title.trim()}
            >
              {editing ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void submitForm(e)} className="space-y-4">
          <Field label="Title" required>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              disabled={submitting}
            />
          </Field>
          <Field label="Description">
            <RichTextEditor
              value={form.description ?? ''}
              onChange={(html) => setForm({ ...form, description: html })}
              disabled={submitting}
              placeholder="High-level overview, links, references…"
            />
          </Field>
          <Field label="Steps">
            <StepsEditor
              steps={form.steps ?? []}
              onChange={(steps) => setForm({ ...form, steps })}
              disabled={submitting}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={form.status ?? 'Todo'}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                className={inputClass}
                disabled={submitting}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assigned To">
              <input
                value={form.assignedTo ?? ''}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className={inputClass}
                disabled={submitting}
                placeholder="email or name"
              />
            </Field>
          </div>
          {formError && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function TaskStepsList({ tasks }: { tasks: Task[] }) {
  const tasksWithSteps = tasks.filter((t) => (t.steps ?? []).length > 0);
  if (tasksWithSteps.length === 0) return null;
  return (
    <section className="mt-6 space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Task details</h2>
      {tasksWithSteps.map((t) => (
        <TaskStepsSection key={t.id} task={t} />
      ))}
    </section>
  );
}

function TaskStepsSection({ task }: { task: Task }) {
  return (
    <div className="space-y-3">
      <header className="border-b border-slate-200 pb-1">
        <h3 className="text-sm font-semibold text-ink">
          <span className="font-mono text-xs text-slate-500">{task.id}</span> {task.title}
        </h3>
      </header>
      <div className="space-y-3">
        {(task.steps as Step[]).map((step, idx) => (
          <StepBlock key={step.id} step={step} index={idx} />
        ))}
      </div>
    </div>
  );
}

function NotesPanel({
  project,
  onRecreated,
}: {
  project: Project;
  onRecreated: (next: Project) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [recreating, setRecreating] = useState(false);
  const previewUrl = project.docId
    ? `https://docs.google.com/document/d/${project.docId}/preview`
    : '';

  async function handleRecreate() {
    if (recreating) return;
    if (!window.confirm('Create a new Notes Doc for this project? The old one will not be touched.')) {
      return;
    }
    setRecreating(true);
    try {
      const next = await api.recreateProjectDoc(project.id);
      await onRecreated(next);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to recreate doc');
    } finally {
      setRecreating(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-ink">{project.title} Notes</h2>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            Google Doc
          </span>
        </div>
        <div className="flex items-center gap-2">
          {project.docId && (
            <a
              href={project.docUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-slate-50"
            >
              Open to edit <ExternalLink size={12} />
            </a>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-slate-50"
          >
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </header>
      {open && (
        <div className="bg-slate-50">
          {project.notesDocAvailable && previewUrl ? (
            <>
              <iframe
                title={`${project.title} Notes`}
                src={previewUrl}
                className="block h-[600px] w-full border-0 bg-white"
              />
              <p className="px-4 py-2 text-[11px] text-slate-500">
                Read-only preview. Click <span className="font-medium">Open to edit</span> to make changes in Google Docs.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-slate-600">Notes doc is unavailable for this project.</p>
              <Button onClick={() => void handleRecreate()} loading={recreating}>
                <RefreshCcw size={14} /> Recreate Notes Doc
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
