import { Plus, Trash2 } from 'lucide-react';
import type { ChecklistItem } from '../../lib/types';

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  disabled?: boolean;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

export function ChecklistEditor({ items, onChange, disabled }: ChecklistEditorProps) {
  function update(id: string, patch: Partial<ChecklistItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }
  function add() {
    onChange([...items, { id: uid(), text: '', done: false }]);
  }

  return (
    <div className="space-y-1.5">
      {items.length === 0 && (
        <p className="text-xs text-slate-400">No checklist items yet.</p>
      )}
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={it.done}
            onChange={(e) => update(it.id, { done: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
          <input
            type="text"
            value={it.text}
            onChange={(e) => update(it.id, { text: e.target.value })}
            disabled={disabled}
            placeholder="Checklist item"
            className={`flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:bg-slate-50 ${
              it.done ? 'text-slate-400 line-through' : ''
            }`}
          />
          <button
            type="button"
            onClick={() => remove(it.id)}
            disabled={disabled}
            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            title="Remove item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <Plus size={12} /> Add item
      </button>
    </div>
  );
}
