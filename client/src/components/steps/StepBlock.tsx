import { AlertTriangle } from 'lucide-react';
import type { Step } from '../../lib/types';

interface StepBlockProps {
  step: Step;
  index: number;
}

export function StepBlock({ step, index }: StepBlockProps) {
  const heading = step.heading || `Step ${index + 1}`;
  const target =
    step.targetStart && step.targetEnd
      ? `${step.targetStart} to ${step.targetEnd}`
      : step.targetStart || step.targetEnd || '';

  return (
    <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-rose-700">{heading}</h3>
        <p className="text-xs text-slate-500">
          {step.owner && (
            <>
              <span className="font-medium text-slate-600">Owner:</span> {step.owner}
            </>
          )}
          {target && (
            <>
              {step.owner && <span className="px-1.5 text-slate-300">·</span>}
              <span className="font-medium text-slate-600">Target:</span> {target}
            </>
          )}
          {step.workingStatus && (
            <>
              <span className="px-1.5 text-slate-300">·</span>
              <span className="font-medium text-slate-600">Status:</span> {step.workingStatus}
            </>
          )}
          {step.assignedTo && (
            <>
              <span className="px-1.5 text-slate-300">·</span>
              <span className="font-medium text-slate-600">Assigned:</span> {step.assignedTo}
            </>
          )}
        </p>
      </header>

      {step.overview && (
        <p className="whitespace-pre-wrap text-sm text-slate-700">{step.overview}</p>
      )}

      {step.checklist.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
          <ul className="space-y-1">
            {step.checklist.map((it) => (
              <li key={it.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={it.done}
                  readOnly
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                />
                <span className={it.done ? 'text-slate-400 line-through' : 'text-slate-700'}>
                  {it.text || ' '}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step.warning && (
        <div className="flex items-start gap-2 rounded-md border-l-4 border-rose-500 bg-fuchsia-50 px-3 py-2 text-sm font-medium text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
          <p className="whitespace-pre-wrap">{step.warning}</p>
        </div>
      )}

      {step.notes && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
          <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {step.notes}
          </p>
        </div>
      )}
    </article>
  );
}
