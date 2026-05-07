import { google } from 'googleapis';
import type { Credentials, OAuth2Client } from 'google-auth-library';
import { getOwner, updateOwnerTokens } from '../store.js';
import { httpError } from './httpError.js';

export const OWNER_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function makeOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    requireEnv('GOOGLE_REDIRECT_URI'),
  );
}

export function getOwnerAuthUrl(): string {
  const client = makeOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: OWNER_OAUTH_SCOPES,
  });
}

export async function exchangeOwnerCode(code: string): Promise<{
  client: OAuth2Client;
  tokens: Credentials;
}> {
  const client = makeOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  return { client, tokens };
}

export async function getOwnerEmail(client: OAuth2Client): Promise<string> {
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? '';
}

let cachedOwnerClient: OAuth2Client | null = null;
let cachedOwnerEmail: string | null = null;

export async function getOwnerClient(): Promise<OAuth2Client> {
  const owner = await getOwner();
  if (!owner) {
    throw httpError(
      503,
      'Google Drive is not connected yet. Click "Connect Google Drive" on the Projects page first.',
    );
  }
  if (cachedOwnerClient && cachedOwnerEmail === owner.email) return cachedOwnerClient;
  if (!owner.tokens.refresh_token && !owner.tokens.access_token) {
    throw httpError(503, 'Owner Google tokens missing — please reconnect Google Drive.');
  }
  const client = makeOAuth2Client();
  client.setCredentials({
    access_token: owner.tokens.access_token ?? undefined,
    refresh_token: owner.tokens.refresh_token ?? undefined,
    expiry_date: owner.tokens.expiry_date ?? undefined,
    scope: owner.tokens.scope ?? undefined,
    token_type: owner.tokens.token_type ?? undefined,
    id_token: owner.tokens.id_token ?? undefined,
  });
  client.on('tokens', (t) => {
    void updateOwnerTokens({
      access_token: t.access_token ?? null,
      refresh_token: t.refresh_token ?? null,
      expiry_date: t.expiry_date ?? null,
      scope: t.scope ?? null,
      token_type: t.token_type ?? null,
      id_token: t.id_token ?? null,
    });
  });
  cachedOwnerClient = client;
  cachedOwnerEmail = owner.email;
  return client;
}

export function invalidateOwnerCache(): void {
  cachedOwnerClient = null;
  cachedOwnerEmail = null;
}
