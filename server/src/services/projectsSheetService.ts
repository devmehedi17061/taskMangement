import { google, type sheets_v4 } from 'googleapis';
import { getServiceAccountAuth } from '../lib/serviceAccountClient.js';
import { getProjectsSheetId as projectsSheetId } from '../lib/appConfig.js';
import { runOnSheet } from '../lib/sheetsQueue.js';
import {
  PROJECTS_HEADERS,
  PROJECTS_SHEET_TAB,
  type Project,
  type ProjectStatus,
} from '../types.js';
import { httpError } from '../lib/httpError.js';

const HEADER_RANGE = `${PROJECTS_SHEET_TAB}!A1:J1`;
const DATA_RANGE = `${PROJECTS_SHEET_TAB}!A2:J`;
const FULL_RANGE = `${PROJECTS_SHEET_TAB}!A:J`;

let cachedSheets: sheets_v4.Sheets | null = null;

function sheets(): sheets_v4.Sheets {
  if (cachedSheets) return cachedSheets;
  cachedSheets = google.sheets({ version: 'v4', auth: getServiceAccountAuth() });
  return cachedSheets;
}

let headerEnsured = false;

async function ensureTabExists(): Promise<void> {
  const meta = await sheets().spreadsheets.get({
    spreadsheetId: projectsSheetId(),
    fields: 'sheets(properties(title))',
  });
  const found = meta.data.sheets?.some((s) => s.properties?.title === PROJECTS_SHEET_TAB);
  if (found) return;
  await sheets().spreadsheets.batchUpdate({
    spreadsheetId: projectsSheetId(),
    requestBody: {
      requests: [{ addSheet: { properties: { title: PROJECTS_SHEET_TAB } } }],
    },
  });
}

export async function ensureProjectsSheet(): Promise<void> {
  if (headerEnsured) return;
  const id = projectsSheetId();
  await ensureTabExists();
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: id,
    range: HEADER_RANGE,
  });
  const row = res.data.values?.[0] ?? [];
  const ok =
    row.length === PROJECTS_HEADERS.length &&
    PROJECTS_HEADERS.every((h, i) => row[i] === h);
  if (!ok) {
    await runOnSheet(id, () =>
      sheets().spreadsheets.values.update({
        spreadsheetId: id,
        range: HEADER_RANGE,
        valueInputOption: 'RAW',
        requestBody: { values: [Array.from(PROJECTS_HEADERS)] },
      }),
    );
  }
  headerEnsured = true;
}

function rowToProject(row: string[]): Project {
  const status = (row[7] ?? 'Active') as ProjectStatus;
  return {
    id: row[0] ?? '',
    title: row[1] ?? '',
    ownerEmail: row[2] ?? '',
    assignedTo: row[3] ?? '',
    sheetId: row[4] ?? '',
    docId: row[5] ?? '',
    folderId: row[6] ?? '',
    status: status === 'Archived' ? 'Archived' : 'Active',
    createdAt: row[8] ?? '',
    updatedAt: row[9] ?? '',
  };
}

function projectToRow(p: Project): string[] {
  return [
    p.id,
    p.title,
    p.ownerEmail,
    p.assignedTo,
    p.sheetId,
    p.docId,
    p.folderId,
    p.status,
    p.createdAt,
    p.updatedAt,
  ];
}

async function readRows(): Promise<string[][]> {
  const { data } = await sheets().spreadsheets.values.get({
    spreadsheetId: projectsSheetId(),
    range: DATA_RANGE,
  });
  return (data.values ?? []) as string[][];
}

export async function listProjects(): Promise<Project[]> {
  await ensureProjectsSheet();
  const rows = await readRows();
  return rows.filter((r) => r[0]).map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  await ensureProjectsSheet();
  const rows = await readRows();
  const row = rows.find((r) => r[0] === id);
  return row ? rowToProject(row) : null;
}

export async function appendProject(project: Project): Promise<void> {
  await ensureProjectsSheet();
  const id = projectsSheetId();
  await runOnSheet(id, () =>
    sheets().spreadsheets.values.append({
      spreadsheetId: id,
      range: FULL_RANGE,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [projectToRow(project)] },
    }),
  );
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  await ensureProjectsSheet();
  const rows = await readRows();
  const idx = rows.findIndex((r) => r[0] === id);
  if (idx === -1) throw httpError(404, `Project ${id} not found`);
  const current = rowToProject(rows[idx]!);
  const next: Project = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  const sheetRow = idx + 2;
  const sheetIdEnv = projectsSheetId();
  await runOnSheet(sheetIdEnv, () =>
    sheets().spreadsheets.values.update({
      spreadsheetId: sheetIdEnv,
      range: `${PROJECTS_SHEET_TAB}!A${sheetRow}:J${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [projectToRow(next)] },
    }),
  );
  return next;
}

export async function removeProject(id: string): Promise<void> {
  await ensureProjectsSheet();
  const rows = await readRows();
  const idx = rows.findIndex((r) => r[0] === id);
  if (idx === -1) return;

  const meta = await sheets().spreadsheets.get({
    spreadsheetId: projectsSheetId(),
    fields: 'sheets(properties(sheetId,title))',
  });
  const tab = meta.data.sheets?.find((s) => s.properties?.title === PROJECTS_SHEET_TAB);
  const tabSheetId = tab?.properties?.sheetId;
  if (tabSheetId === undefined || tabSheetId === null) {
    throw new Error(`Tab "${PROJECTS_SHEET_TAB}" not found`);
  }
  const startIndex = idx + 1;
  const sheetIdEnv = projectsSheetId();
  await runOnSheet(sheetIdEnv, () =>
    sheets().spreadsheets.batchUpdate({
      spreadsheetId: sheetIdEnv,
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
