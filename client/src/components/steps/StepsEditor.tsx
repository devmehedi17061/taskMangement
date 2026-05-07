import { Plus } from 'lucide-react';
import type { Step } from '../../lib/types';
import { StepCard } from './StepCard';

interface StepsEditorProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  disabled?: boolean;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

function makeStep(): Step {
  return {
    id: uid(),
    heading: '',
    owner: '',
    targetStart: '',
    targetEnd: '',
    overview: '',
    checklist: [],
    warning: '',
    notes: '',
    workingStatus: '',
    assignedTo: '',
  };
}

export function StepsEditor({ steps, onChange, disabled }: StepsEditorProps) {
  function update(idx: number, step: Step) {
    onChange(steps.map((s, i) => (i === idx ? step : s)));
  }
  function remove(idx: number) {
    onChange(steps.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...steps, makeStep()]);
  }

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">
          No steps yet. Add a step to break this task down (heading, owner, target dates, checklist, warning, notes).
        </p>
      )}
      {steps.map((s, i) => (
        <StepCard
          key={s.id}
          step={s}
          index={i}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
          disabled={disabled}
        />
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <Plus size={14} /> Step
      </button>
    </div>
  );
}
