import { Pencil, Trash2 } from 'lucide-react';
import type { Task, TaskStatus } from '../lib/types';
import { TASK_STATUSES } from '../lib/types';

interface TaskTableProps {
  tasks: Task[];
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  pendingTaskId: string | null;
}

function htmlToPreview(html: string, max = 120): string {
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max - 1) + '…';
}

const STATUS_PILL: Record<TaskStatus, string> = {
  Todo: 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Done: 'bg-emerald-100 text-emerald-700',
};

export function TaskTable({ tasks, onStatusChange, onEdit, onDelete, pendingTaskId }: TaskTableProps) {
  if (!tasks.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No tasks yet.
      </div>
    );
  }
  const showActions = Boolean(onEdit || onDelete);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2.5">ID</th>
            <th className="px-4 py-2.5">Title</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Assigned To</th>
            <th className="px-4 py-2.5">Created</th>
            {showActions && <th className="px-4 py-2.5"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((t) => {
            const pending = pendingTaskId === t.id;
            return (
              <tr key={t.id} className={pending ? 'opacity-60' : undefined}>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{t.id}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-ink">{t.title}</div>
                  {t.description && (
                    <div className="text-xs text-slate-500">{htmlToPreview(t.description)}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[t.status]}`}>
                    {onStatusChange ? (
                      <select
                        value={t.status}
                        disabled={pending}
                        onChange={(e) => onStatusChange(t, e.target.value as TaskStatus)}
                        className="bg-transparent outline-none"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{t.status}</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-700">{t.assignedTo || '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                </td>
                {showActions && (
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(t)}
                          disabled={pending}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(t)}
                          disabled={pending}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
