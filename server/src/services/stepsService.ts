import { randomUUID } from 'node:crypto';
import { httpError } from '../lib/httpError.js';
import type { ChecklistItem, Step } from '../types.js';

const MAX_STEPS_JSON_CHARS = 40000;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function sanitizeChecklistItem(raw: unknown): ChecklistItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: s(r.id) || randomUUID(),
    text: s(r.text),
    done: r.done === true,
  };
}

export function sanitizeStep(raw: unknown): Step {
  const r = (raw ?? {}) as Record<string, unknown>;
  const checklist = Array.isArray(r.checklist) ? r.checklist.map(sanitizeChecklistItem) : [];
  return {
    id: s(r.id) || randomUUID(),
    heading: s(r.heading),
    owner: s(r.owner),
    targetStart: s(r.targetStart),
    targetEnd: s(r.targetEnd),
    overview: s(r.overview),
    checklist,
    warning: s(r.warning),
    notes: s(r.notes),
    workingStatus: s(r.workingStatus),
    assignedTo: s(r.assignedTo),
  };
}

export function sanitizeSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeStep);
}

export function parseStepsJson(cell: string | undefined | null): Step[] {
  if (!cell) return [];
  const trimmed = String(cell).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return sanitizeSteps(parsed);
  } catch {
    return [];
  }
}

export function serializeSteps(steps: Step[]): string {
  if (!steps || steps.length === 0) return '';
  const json = JSON.stringify(steps);
  if (json.length > MAX_STEPS_JSON_CHARS) {
    throw httpError(
      413,
      `Steps payload too large (${json.length} chars; max ${MAX_STEPS_JSON_CHARS}).`,
    );
  }
  return json;
}
