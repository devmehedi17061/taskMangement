import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OAuthTokens, OwnerRecord, Provisioned, SessionStoreShape } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_PATH = path.resolve(__dirname, '..', 'data', 'store.json');

const EMPTY_STORE: SessionStoreShape = { sessions: {}, provisioned: null, owner: null };

const KV_KEYS = {
  session: (sid: string) => `dp:session:${sid}`,
  provisioned: 'dp:provisioned',
  owner: 'dp:owner',
};

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvCommand<T = unknown>(args: (string | number)[]): Promise<T> {
  const env = kvEnv();
  if (!env) throw new Error('KV not configured');
  const res = await fetch(env.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`KV request failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new Error(`KV error: ${json.error}`);
  return json.result as T;
}

async function kvGet<T>(key: string): Promise<T | null> {
  const raw = await kvCommand<string | null>(['GET', key]);
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  await kvCommand<string>(['SET', key, payload]);
}

async function kvDel(key: string): Promise<void> {
  await kvCommand<number>(['DEL', key]);
}

let fileCache: SessionStoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function readFromDisk(): Promise<SessionStoreShape> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SessionStoreShape>;
    return {
      sessions: parsed.sessions ?? {},
      provisioned: parsed.provisioned ?? null,
      owner: parsed.owner ?? null,
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return structuredClone(EMPTY_STORE);
    }
    throw err;
  }
}

async function writeToDisk(state: SessionStoreShape): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, STORE_PATH);
}

async function loadFile(): Promise<SessionStoreShape> {
  if (!fileCache) fileCache = await readFromDisk();
  return fileCache;
}

function persistFile(): Promise<void> {
  const next = writeChain.then(async () => {
    if (!fileCache) return;
    await writeToDisk(fileCache);
  });
  writeChain = next.catch(() => undefined);
  return next;
}

export async function createSession(sid: string, userId: string): Promise<void> {
  if (kvEnv()) {
    await kvSet(KV_KEYS.session(sid), userId);
    return;
  }
  const store = await loadFile();
  store.sessions[sid] = userId;
  await persistFile();
}

export async function getSession(sid: string): Promise<string | undefined> {
  if (kvEnv()) {
    const v = await kvGet<string>(KV_KEYS.session(sid));
    return v ?? undefined;
  }
  const store = await loadFile();
  return store.sessions[sid];
}

export async function deleteSession(sid: string): Promise<void> {
  if (kvEnv()) {
    await kvDel(KV_KEYS.session(sid));
    return;
  }
  const store = await loadFile();
  if (store.sessions[sid]) {
    delete store.sessions[sid];
    await persistFile();
  }
}

export async function getProvisioned(): Promise<Provisioned | null> {
  if (kvEnv()) return await kvGet<Provisioned>(KV_KEYS.provisioned);
  const store = await loadFile();
  return store.provisioned ?? null;
}

export async function saveProvisioned(p: Provisioned): Promise<void> {
  if (kvEnv()) {
    await kvSet(KV_KEYS.provisioned, p);
    return;
  }
  const store = await loadFile();
  store.provisioned = p;
  await persistFile();
}

export async function getOwner(): Promise<OwnerRecord | null> {
  if (kvEnv()) return await kvGet<OwnerRecord>(KV_KEYS.owner);
  const store = await loadFile();
  return store.owner ?? null;
}

export async function saveOwner(email: string, tokens: OAuthTokens): Promise<void> {
  const previous = await getOwner();
  const next: OwnerRecord = {
    email,
    tokens: {
      ...previous?.tokens,
      ...tokens,
      refresh_token: tokens.refresh_token ?? previous?.tokens.refresh_token ?? null,
    },
    connectedAt: previous?.connectedAt ?? new Date().toISOString(),
  };
  if (kvEnv()) {
    await kvSet(KV_KEYS.owner, next);
    return;
  }
  const store = await loadFile();
  store.owner = next;
  await persistFile();
}

export async function updateOwnerTokens(tokens: OAuthTokens): Promise<void> {
  const previous = await getOwner();
  if (!previous) return;
  const next: OwnerRecord = {
    ...previous,
    tokens: {
      ...previous.tokens,
      ...tokens,
      refresh_token: tokens.refresh_token ?? previous.tokens.refresh_token ?? null,
    },
  };
  if (kvEnv()) {
    await kvSet(KV_KEYS.owner, next);
    return;
  }
  const store = await loadFile();
  if (!store.owner) return;
  store.owner = next;
  await persistFile();
}
