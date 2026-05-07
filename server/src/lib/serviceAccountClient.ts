import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
];

let cached: GoogleAuth | null = null;

function keyFilePath(): string {
  const rel = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (!rel) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_FILE is not set');
  return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
}

export function getServiceAccountAuth(): GoogleAuth {
  if (cached) return cached;
  cached = new GoogleAuth({
    keyFile: keyFilePath(),
    scopes: SCOPES,
  });
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
