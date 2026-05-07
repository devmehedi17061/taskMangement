import { google, type sheets_v4 } from 'googleapis';
import { TASKS_SHEET_TAB, TASK_HEADERS, type Task, type TaskInput, type TaskStatus } from '../types.js';
import { generateUniqueId } from '../idGenerator.js';
import { httpError } from '../lib/httpError.js';
import { moveFileToFolder } from './driveService.js';
import { runOnSheet } from '../lib/sheetsQueue.js';
import { getOwnerClient } from '../lib/ownerClient.js';
import { parseStepsJson, sanitizeSteps, serializeSteps } from './stepsService.js';

const COLUMN_RANGE = 'A:J';
const HEADER_RANGE = `${TASKS_SHEET_TAB}!A1:J1`;
const DATA_RANGE = `${TASKS_SHEET_TAB}!A2:J`;

async function sheets(): Promise<sheets_v4.Sheets> {
  const auth = await getOwnerClient();
  return google.sheets({ version: 'v4', auth });
}

export async function createTasksSheet(projectName: string, folderId: string): Promise<string> {
  const s = await sheets();
  const created = await s.spreadsheets.create({
    requestBody: {
      properties: { title: `${projectName} Tasks` },
      sheets: [{ properties: { title: TASKS_SHEET_TAB } }],
    },
    fields: 'spreadsheetId',
  });
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error('Sheets create returned no spreadsheetId');

  await runOnSheet(spreadsheetId, () =>
    s.spreadsheets.values.update({
      spreadsheetId,
      range: HEADER_RANGE,
      valueInputOption: 'RAW',
      requestBody: { values: [Array.from(TASK_HEADERS)] },
    }),
  );

  await moveFileToFolder(spreadsheetId, folderId);
  return spreadsheetId;
}

function rowToTask(row: string[]): Task {
  const html = (row[6] ?? '').toString().trim() !== ''
    ? (row[6] ?? '').toString()
    : (row[2] ?? '').toString();
  return {
    id: row[0] ?? '',
    title: row[1] ?? '',
    description: html,
    status: ((row[3] as TaskStatus) || 'Todo'),
    assignedTo: row[4] ?? '',
    createdAt: row[5] ?? '',
    steps: parseStepsJson(row[7]),
    updatedAt: row[9] ?? row[5] ?? '',
  };
}

function taskToRow(t: Task): string[] {
  const stepsJson = serializeSteps(t.steps ?? []);
  const stepCount = String((t.steps ?? []).length);
  return [
    t.id,
    t.title,
    '',
    t.status,
    t.assignedTo,
    t.createdAt,
    t.description,
    stepsJson,
    stepCount,
    t.updatedAt,
  ];
}

async function readDataRows(spreadsheetId: string): Promise<string[][]> {
  const s = await sheets();
  const { data } = await s.spreadsheets.values.get({
    spreadsheetId,
    range: DATA_RANGE,
  });
  return (data.values ?? []) as string[][];
}

export async function listTasks(spreadsheetId: string): Promise<Task[]> {
  const rows = await readDataRows(spreadsheetId);
  return rows.filter((r) => r[0]).map(rowToTask);
}

export async function getTask(spreadsheetId: string, taskId: string): Promise<Task | null> {
  const rows = await readDataRows(spreadsheetId);
  const row = rows.find((r) => r[0] === taskId);
  return row ? rowToTask(row) : null;
}

async function getTasksTabSheetId(spreadsheetId: string): Promise<number> {
  const s = await sheets();
  const meta = await s.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });
  const tab = meta.data.sheets?.find((sh) => sh.properties?.title === TASKS_SHEET_TAB);
  const id = tab?.properties?.sheetId;
  if (id === undefined || id === null) throw new Error(`Tab "${TASKS_SHEET_TAB}" not found`);
  return id;
}

export async function addTask(spreadsheetId: string, input: TaskInput): Promise<Task> {
  if (!input.title || !input.title.trim()) {
    throw httpError(400, 'title is required');
  }
  const rows = await readDataRows(spreadsheetId);
  const existingIds = rows.map((r) => r[0] ?? '').filter(Boolean);
  const id = generateUniqueId(existingIds, 'T');
  const now = new Date().toISOString();
  const task: Task = {
    id,
    title: input.title.trim(),
    description: input.description ?? '',
    steps: sanitizeSteps(input.steps),
    status: input.status ?? 'Todo',
    assignedTo: input.assignedTo ?? '',
    createdAt: now,
    updatedAt: now,
  };
  const s = await sheets();
  await runOnSheet(spreadsheetId, () =>
    s.spreadsheets.values.append({
      spreadsheetId,
      range: `${TASKS_SHEET_TAB}!${COLUMN_RANGE}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [taskToRow(task)] },
    }),
  );
  return task;
}

export async function updateTask(
  spreadsheetId: string,
  taskId: string,
  patch: Partial<TaskInput>,
): Promise<Task> {
  const rows = await readDataRows(spreadsheetId);
  const idx = rows.findIndex((r) => r[0] === taskId);
  if (idx === -1) throw httpError(404, `Task ${taskId} not found`);
  const current = rowToTask(rows[idx]!);
  const next: Task = {
    ...current,
    title: patch.title !== undefined ? patch.title : current.title,
    description: patch.description !== undefined ? patch.description : current.description,
    steps: patch.steps !== undefined ? sanitizeSteps(patch.steps) : current.steps,
    status: patch.status !== undefined ? patch.status : current.status,
    assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : current.assignedTo,
    updatedAt: new Date().toISOString(),
  };
  const sheetRow = idx + 2;
  const s = await sheets();
  await runOnSheet(spreadsheetId, () =>
    s.spreadsheets.values.update({
      spreadsheetId,
      range: `${TASKS_SHEET_TAB}!A${sheetRow}:J${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [taskToRow(next)] },
    }),
  );
  return next;
}

export async function deleteTask(spreadsheetId: string, taskId: string): Promise<void> {
  const rows = await readDataRows(spreadsheetId);
  const idx = rows.findIndex((r) => r[0] === taskId);
  if (idx === -1) throw httpError(404, `Task ${taskId} not found`);
  const tabSheetId = await getTasksTabSheetId(spreadsheetId);
  const startIndex = idx + 1;
  const s = await sheets();
  await runOnSheet(spreadsheetId, () =>
    s.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: tabSheetId,
                dimension: 'ROWS',
                startIndex,
                endIndex: startIndex + 1,
              },
            },
          },
        ],
      },
    }),
  );
}

export function sheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
