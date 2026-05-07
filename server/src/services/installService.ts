import { google, type drive_v3, type sheets_v4 } from 'googleapis';
import { getServiceAccountAuth, getServiceAccountEmail } from '../lib/serviceAccountClient.js';
import { setAppConfig } from '../lib/appConfig.js';
import { getProvisioned, saveProvisioned } from '../store.js';
import {
  PROJECTS_HEADERS,
  PROJECTS_SHEET_TAB,
  ROOT_FOLDER_NAME,
} from '../types.js';
import { USERS_HEADERS, USERS_TAB } from './usersSheetService.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function envOr(name: string, fallback: string | undefined | null): string | null {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback && fallback.trim()) return fallback.trim();
  return null;
}

async function ensureRootFolder(drive: drive_v3.Drive): Promise<string> {
  const search = await drive.files.list({
    q: `name = '${ROOT_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
  });
  const found = search.data.files?.[0];
  if (found?.id) return found.id;

  const created = await drive.files.create({
    requestBody: {
      name: ROOT_FOLDER_NAME,
      mimeType: FOLDER_MIME,
      parents: ['root'],
    },
    fields: 'id',
  });
  if (!created.data.id) throw new Error('Drive folder create returned no id');
  return created.data.id;
}

async function ensureSpreadsheet(
  sheets: sheets_v4.Sheets,
  drive: drive_v3.Drive,
  rootFolderId: string,
  title: string,
  tab: string,
  headers: readonly string[],
): Promise<string> {
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: tab } }],
    },
    fields: 'spreadsheetId',
  });
  const id = created.data.spreadsheetId;
  if (!id) throw new Error(`${title} create returned no spreadsheetId`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(headers)] },
  });

  const meta = await drive.files.get({ fileId: id, fields: 'parents', supportsAllDrives: true });
  const previous = (meta.data.parents ?? []).join(',');
  await drive.files.update({
    fileId: id,
    addParents: rootFolderId,
    removeParents: previous || undefined,
    fields: 'id, parents',
    supportsAllDrives: true,
  });
  return id;
}

async function ensureTabAndHeaders(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string,
  headers: readonly string[],
): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title))',
  });
  const tabExists = meta.data.sheets?.some((s) => s.properties?.title === tab);
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  const headerRange = `${tab}!A1:${String.fromCharCode(64 + headers.length)}1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: headerRange });
  const row = res.data.values?.[0] ?? [];
  const ok = row.length === headers.length && headers.every((h, i) => row[i] === h);
  if (!ok) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: { values: [Array.from(headers)] },
    });
  }
}

export async function bootstrapInstall(): Promise<void> {
  const auth = getServiceAccountAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const cached = await getProvisioned();

  let rootFolderId = envOr('APP_ROOT_FOLDER_ID', cached?.rootFolderId);
  let usersSheetId = envOr('USERS_SHEET_ID', cached?.usersSheetId);
  let projectsSheetId = envOr('PROJECTS_SHEET_ID', cached?.projectsSheetId);

  let createdAnything = false;

  if (!rootFolderId) {
    rootFolderId = await ensureRootFolder(drive);
    createdAnything = true;
    console.log(`[install] auto-created root folder "${ROOT_FOLDER_NAME}": ${rootFolderId}`);
  }

  if (!usersSheetId) {
    usersSheetId = await ensureSpreadsheet(
      sheets,
      drive,
      rootFolderId,
      'Drive Projects — Users',
      USERS_TAB,
      USERS_HEADERS,
    );
    createdAnything = true;
    console.log(`[install] auto-created Users sheet: ${usersSheetId}`);
  } else {
    await ensureTabAndHeaders(sheets, usersSheetId, USERS_TAB, USERS_HEADERS);
  }

  if (!projectsSheetId) {
    projectsSheetId = await ensureSpreadsheet(
      sheets,
      drive,
      rootFolderId,
      'Drive Projects — Projects',
      PROJECTS_SHEET_TAB,
      PROJECTS_HEADERS,
    );
    createdAnything = true;
    console.log(`[install] auto-created Projects sheet: ${projectsSheetId}`);
  } else {
    await ensureTabAndHeaders(sheets, projectsSheetId, PROJECTS_SHEET_TAB, PROJECTS_HEADERS);
  }

  setAppConfig({ rootFolderId, usersSheetId, projectsSheetId });

  if (createdAnything || !cached) {
    await saveProvisioned({ rootFolderId, usersSheetId, projectsSheetId });
  }

  if (createdAnything) {
    const email = await getServiceAccountEmail().catch(() => '<unknown>');
    console.log(
      `[install] Resources owned by service account ${email}. To open them in your own Drive UI, share each id back to your account or pin APP_ROOT_FOLDER_ID/USERS_SHEET_ID/PROJECTS_SHEET_ID in .env to a folder/sheet you already own.`,
    );
  }

  console.log('[install] resolved config:', { rootFolderId, usersSheetId, projectsSheetId });
}
