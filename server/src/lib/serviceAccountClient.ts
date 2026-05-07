import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
];

let cached: GoogleAuth | null = null;

function inlineCredentials(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_KEY_JSON is set but is not valid JSON: ${(err as Error).message}`,
    );
  }
}

function keyFilePath(): string | null {
  const rel = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (!rel) return null;
  return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
}

export function getServiceAccountAuth(): GoogleAuth {
  if (cached) return cached;
  const credentials = inlineCredentials();
  if (credentials) {
    cached = new GoogleAuth({ credentials, scopes: SCOPES });
    return cached;
  }
  const file = keyFilePath();
  if (!file) {
    throw new Error(
      'No service-account credentials found — set GOOGLE_SERVICE_ACCOUNT_KEY_JSON (full JSON, used on Vercel) or GOOGLE_SERVICE_ACCOUNT_KEY_FILE (path, used locally).',
    );
  }
  cached = new GoogleAuth({ keyFile: file, scopes: SCOPES });
  return cached;
}

export async function getServiceAccountEmail(): Promise<string> {
  const auth = getServiceAccountAuth();
  const client = await auth.getClient();
  const email = (client as { email?: string }).email;
  if (email) return email;
  const credentials = await auth.getCredentials();
  return credentials.client_email ?? '';
}
