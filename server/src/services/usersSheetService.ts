import { google, type sheets_v4 } from 'googleapis';
import { getServiceAccountAuth } from '../lib/serviceAccountClient.js';
import { getUsersSheetId } from '../lib/appConfig.js';

export const USERS_TAB = 'Users';
export const USERS_HEADERS = ['id', 'name', 'email', 'passwordHash', 'createdAt'] as const;

export interface UsersSheetRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  rowIndex: number;
}

let cachedClient: sheets_v4.Sheets | null = null;

function spreadsheetId(): string {
  return getUsersSheetId();
}

function sheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  cachedClient = google.sheets({ version: 'v4', auth: getServiceAccountAuth() });
  return cachedClient;
}

async function ensureUsersTab(): Promise<void> {
  const sheets = sheetsClient();
  const id = spreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: 'sheets(properties(title))',
  });
  const found = meta.data.sheets?.some((s) => s.properties?.title === USERS_TAB);
  if (found) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{ addSheet: { properties: { title: USERS_TAB } } }],
    },
  });
}

export async function ensureHeaderRow(): Promise<void> {
  await ensureUsersTab();
  const sheets = sheetsClient();
  const id = spreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${USERS_TAB}!A1:E1`,
  });
  const row = res.data.values?.[0] ?? [];
  const headersMatch =
    row.length === USERS_HEADERS.length &&
    USERS_HEADERS.every((h, i) => row[i] === h);
  if (headersMatch) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${USERS_TAB}!A1:E1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(USERS_HEADERS)] },
  });
}

function rowToUser(r: unknown[], rowIndex: number): UsersSheetRow {
  return {
    id: (r[0] ?? '').toString(),
    name: (r[1] ?? '').toString(),
    email: (r[2] ?? '').toString(),
    passwordHash: (r[3] ?? '').toString(),
    createdAt: (r[4] ?? '').toString(),
    rowIndex,
  };
}

export async function findUserByEmail(email: string): Promise<UsersSheetRow | null> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${USERS_TAB}!A2:E`,
  });
  const rows = res.data.values ?? [];
  const target = email.trim().toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if ((r[2] ?? '').toString().trim().toLowerCase() === target) {
      return rowToUser(r, i + 2);
    }
  }
  return null;
}

export async function findUserById(id: string): Promise<UsersSheetRow | null> {
  if (!id) return null;
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${USERS_TAB}!A2:E`,
  });
  const rows = res.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if ((r[0] ?? '').toString() === id) {
      return rowToUser(r, i + 2);
    }
  }
  return null;
}

export interface AppendUserInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export async function appendUser(input: AppendUserInput): Promise<void> {
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${USERS_TAB}!A:E`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[input.id, input.name, input.email, input.passwordHash, input.createdAt]],
    },
  });
}
