import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { Step } from '../../lib/types';
import { ChecklistEditor } from './ChecklistEditor';

interface StepCardProps {
  step: Step;
  index: number;
  onChange: (step: Step) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:bg-slate-50';

const textareaClass =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:bg-slate-50';

export function StepCard({ step, index, onChange, onRemove, disabled }: StepCardProps) {
  const [open, setOpen] = useState(true);

  function patch(p: Partial<Step>) {
    onChange({ ...step, ...p });
  }

  const summaryHeading = step.heading || `Step ${index + 1}`;
  const summaryMeta = [step.owner, step.targetStart && step.targetEnd ? `${step.targetStart} → ${step.targetEnd}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-slate-400">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-rose-700">{summaryHeading}</span>
            {summaryMeta && <span className="block truncate text-xs text-slate-500">{summaryMeta}</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
          title="Remove step"
        >
          <Trash2 size={14} />
        </button>
      </header>

      {open && (
        <div className="space-y-3 border-t border-slate-200 bg-white px-3 py-3">
          <Field label="Heading">
            <input
              value={step.heading}
              onChange={(e) => patch({ heading: e.target.value })}
              placeholder={`Step ${index + 1}.`}
              disabled={disabled}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Owner">
              <input
                value={step.owner}
                onChange={(e) => patch({ owner: e.target.value })}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
            <Field label="Target start">
              <input
                type="date"
                value={step.targetStart}
                onChange={(e) => patch({ targetStart: e.target.value })}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
            <Field label="Target end">
              <input
                type="date"
                value={step.targetEnd}
                onChange={(e) => patch({ targetEnd: e.target.value })}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Overview">
            <textarea
              rows={3}
              value={step.overview}
              onChange={(e) => patch({ overview: e.target.value })}
              disabled={disabled}
              className={textareaClass}
            />
          </Field>
          <Field label="Checklist">
            <ChecklistEditor
              items={step.checklist}
              onChange={(checklist) => patch({ checklist })}
              disabled={disabled}
            />
          </Field>
          <Field label="Warning callout">
            <textarea
              rows={2}
              value={step.warning}
              onChange={(e) => patch({ warning: e.target.value })}
              disabled={disabled}
              placeholder="DO NOT MISS THIS — …"
              className={`${textareaClass} bg-fuchsia-50 text-rose-800 placeholder:text-rose-300`}
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={2}
              value={step.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              disabled={disabled}
              className={textareaClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Working status">
              <input
                value={step.workingStatus}
                onChange={(e) => patch({ workingStatus: e.target.value })}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
            <Field label="Assigned to">
              <input
                value={step.assignedTo}
                onChange={(e) => patch({ assignedTo: e.target.value })}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}
