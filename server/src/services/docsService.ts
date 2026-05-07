import { google, type docs_v1 } from 'googleapis';
import { getOwnerClient } from '../lib/ownerClient.js';
import { moveFileToFolder, shareAnyoneReader } from './driveService.js';
import {
  buildSectionRequests,
  endOfBodyIndex,
  findSectionRange,
  isDocEmpty,
  parseHtmlToBlocks,
  type Block,
} from './docSync.js';
import type { Step } from '../types.js';

async function docs(): Promise<docs_v1.Docs> {
  const auth = await getOwnerClient();
  return google.docs({ version: 'v1', auth });
}

function boldLabel(text: string): Block {
  return { type: 'p', runs: [{ text, bold: true }] };
}

function buildDescriptionBlocks(descriptionHtml: string): Block[] {
  const parsed = parseHtmlToBlocks(descriptionHtml);
  if (parsed.length === 0) return [];
  return [boldLabel('Overview'), ...parsed];
}

function buildHeader(taskId: string, title: string): string {
  return `Task ${taskId} — ${title || 'Untitled'}`;
}

interface StepLine {
  text: string;
  kind: 'heading' | 'meta' | 'overview' | 'checklist' | 'warning' | 'notesLabel' | 'notesBody';
  done?: boolean;
}

interface StepRange extends StepLine {
  start: number;
  end: number;
  paraEnd: number;
}

const ROSE = { red: 0.76, green: 0.09, blue: 0.36 };
const META_GRAY = { red: 0.42, green: 0.45, blue: 0.50 };
const WARN_BG = { red: 0.99, green: 0.91, blue: 0.93 };
const WARN_FG = { red: 0.74, green: 0.09, blue: 0.36 };
const DONE_GRAY = { red: 0.61, green: 0.64, blue: 0.69 };

function formatTarget(step: Step): string {
  const owner = step.owner || '—';
  const start = step.targetStart || '';
  const end = step.targetEnd || '';
  if (start && end) return `Owner: ${owner}    Target: ${start} to ${end}`;
  if (start) return `Owner: ${owner}    Target: ${start}`;
  if (end) return `Owner: ${owner}    Target: ${end}`;
  return `Owner: ${owner}`;
}

function buildStepRequests(
  startIndex: number,
  step: Step,
): { requests: docs_v1.Schema$Request[]; insertedLength: number } {
  const lines: StepLine[] = [];
  lines.push({ text: step.heading || 'Step', kind: 'heading' });
  lines.push({ text: formatTarget(step), kind: 'meta' });
  if (step.overview && step.overview.trim()) {
    lines.push({ text: step.overview, kind: 'overview' });
  }
  const checklistStart = lines.length;
  for (const item of step.checklist ?? []) {
    lines.push({ text: item.text || ' ', kind: 'checklist', done: item.done });
  }
  const checklistEnd = lines.length;
  if (step.warning && step.warning.trim()) {
    lines.push({ text: step.warning, kind: 'warning' });
  }
  if (step.notes && step.notes.trim()) {
    lines.push({ text: 'Notes', kind: 'notesLabel' });
    lines.push({ text: step.notes, kind: 'notesBody' });
  }

  let buffer = '';
  const ranges: StepRange[] = [];
  for (const line of lines) {
    const start = startIndex + buffer.length;
    buffer += line.text + '\n';
    const end = start + line.text.length;
    ranges.push({ ...line, start, end, paraEnd: end + 1 });
  }

  const requests: docs_v1.Schema$Request[] = [];
  if (!buffer) return { requests, insertedLength: 0 };

  requests.push({ insertText: { location: { index: startIndex }, text: buffer } });

  for (const r of ranges) {
    if (r.kind === 'heading') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: r.start, endIndex: r.paraEnd },
          paragraphStyle: { namedStyleType: 'HEADING_2' },
          fields: 'namedStyleType',
        },
      });
      if (r.start < r.end) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: r.start, endIndex: r.end },
            textStyle: {
              bold: true,
              foregroundColor: { color: { rgbColor: ROSE } },
            },
            fields: 'bold,foregroundColor',
          },
        });
      }
    } else if (r.kind === 'meta') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: r.start, endIndex: r.paraEnd },
          paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
          fields: 'namedStyleType',
        },
      });
      if (r.start < r.end) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: r.start, endIndex: r.end },
            textStyle: {
              fontSize: { magnitude: 9, unit: 'PT' },
              foregroundColor: { color: { rgbColor: META_GRAY } },
            },
            fields: 'fontSize,foregroundColor',
          },
        });
      }
    } else if (r.kind === 'overview') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: r.start, endIndex: r.paraEnd },
          paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
          fields: 'namedStyleType',
        },
      });
    } else if (r.kind === 'warning') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: r.start, endIndex: r.paraEnd },
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
            shading: { backgroundColor: { color: { rgbColor: WARN_BG } } },
          },
          fields: 'namedStyleType,shading.backgroundColor',
        },
      });
      if (r.start < r.end) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: r.start, endIndex: r.end },
            textStyle: {
              bold: true,
              foregroundColor: { color: { rgbColor: WARN_FG } },
            },
            fields: 'bold,foregroundColor',
          },
        });
      }
    } else if (r.kind === 'notesLabel') {
      if (r.start < r.end) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: r.start, endIndex: r.end },
            textStyle: { bold: true },
            fields: 'bold',
          },
        });
      }
    }
  }

  if (checklistEnd > checklistStart) {
    const first = ranges[checklistStart]!;
    const last = ranges[checklistEnd - 1]!;
    requests.push({
      createParagraphBullets: {
        range: { startIndex: first.start, endIndex: last.paraEnd },
        bulletPreset: 'BULLET_CHECKBOX',
      },
    });
    for (let i = checklistStart; i < checklistEnd; i++) {
      const r = ranges[i]!;
      if (r.done && r.start < r.end) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: r.start, endIndex: r.end },
            textStyle: {
              strikethrough: true,
              foregroundColor: { color: { rgbColor: DONE_GRAY } },
            },
            fields: 'strikethrough,foregroundColor',
          },
        });
      }
    }
  }

  return { requests, insertedLength: buffer.length };
}

export async function createNotesDoc(projectName: string, folderId: string): Promise<string> {
  const created = await (await docs()).documents.create({
    requestBody: { title: `${projectName} Notes` },
  });
  const docId = created.data.documentId;
  if (!docId) throw new Error('Docs create returned no documentId');
  await moveFileToFolder(docId, folderId);
  await shareAnyoneReader(docId);
  return docId;
}

export function docUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

export async function appendTaskSection(
  docId: string,
  taskId: string,
  title: string,
  descriptionHtml: string,
  steps: Step[],
): Promise<void> {
  const { data: doc } = await (await docs()).documents.get({ documentId: docId });
  const startIndex = endOfBodyIndex(doc);
  const descBlocks = buildDescriptionBlocks(descriptionHtml);
  const descRes = buildSectionRequests(
    startIndex,
    !isDocEmpty(doc),
    buildHeader(taskId, title),
    descBlocks,
  );
  let cursor = startIndex + descRes.insertedLength;
  const stepRequests: docs_v1.Schema$Request[] = [];
  for (const step of steps ?? []) {
    const r = buildStepRequests(cursor, step);
    stepRequests.push(...r.requests);
    cursor += r.insertedLength;
  }
  const requests = [...descRes.requests, ...stepRequests];
  if (!requests.length) return;
  await (await docs()).documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });
}

export async function updateTaskSection(
  docId: string,
  taskId: string,
  title: string,
  descriptionHtml: string,
  steps: Step[],
): Promise<void> {
  const { data: doc } = await (await docs()).documents.get({ documentId: docId });
  const range = findSectionRange(doc, taskId);
  if (!range) {
    return appendTaskSection(docId, taskId, title, descriptionHtml, steps);
  }

  const descBlocks = buildDescriptionBlocks(descriptionHtml);
  const descRes = buildSectionRequests(
    range.startIndex,
    false,
    buildHeader(taskId, title),
    descBlocks,
  );
  let cursor = range.startIndex + descRes.insertedLength;
  const stepRequests: docs_v1.Schema$Request[] = [];
  for (const step of steps ?? []) {
    const r = buildStepRequests(cursor, step);
    stepRequests.push(...r.requests);
    cursor += r.insertedLength;
  }
  const requests: docs_v1.Schema$Request[] = [
    {
      deleteContentRange: {
        range: { startIndex: range.startIndex, endIndex: range.endIndex },
      },
    },
    ...descRes.requests,
    ...stepRequests,
  ];
  await (await docs()).documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });
}

export async function removeTaskSection(docId: string, taskId: string): Promise<void> {
  const { data: doc } = await (await docs()).documents.get({ documentId: docId });
  const range = findSectionRange(doc, taskId);
  if (!range) return;
  await (await docs()).documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          deleteContentRange: {
            range: { startIndex: range.startIndex, endIndex: range.endIndex },
          },
        },
      ],
    },
  });
}
