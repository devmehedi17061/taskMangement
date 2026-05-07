import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OAuthTokens, OwnerRecord, Provisioned, SessionStoreShape } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_PATH = path.resolve(__dirname, '..', 'data', 'store.json');

const EMPTY_STORE: SessionStoreShape = { sessions: {}, provisioned: null, owner: null };

let cache: SessionStoreShape | null = null;
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

async function load(): Promise<SessionStoreShape> {
  if (!cache) cache = await readFromDisk();
  return cache;
}

function persist(): Promise<void> {
  const next = writeChain.then(async () => {
    if (!cache) return;
    await writeToDisk(cache);
  });
  writeChain = next.catch(() => undefined);
  return next;
}

export async function createSession(sid: string, userId: string): Promise<void> {
  const store = await load();
  store.sessions[sid] = userId;
  await persist();
}

export async function getSession(sid: string): Promise<string | undefined> {
  const store = await load();
  return store.sessions[sid];
}

export async function deleteSession(sid: string): Promise<void> {
  const store = await load();
  if (store.sessions[sid]) {
    delete store.sessions[sid];
    await persist();
  }
}

export async function getProvisioned(): Promise<Provisioned | null> {
  const store = await load();
  return store.provisioned ?? null;
}

export async function saveProvisioned(p: Provisioned): Promise<void> {
  const store = await load();
  store.provisioned = p;
  await persist();
}

export async function getOwner(): Promise<OwnerRecord | null> {
  const store = await load();
  return store.owner ?? null;
}

export async function saveOwner(email: string, tokens: OAuthTokens): Promise<void> {
  const store = await load();
  const previous = store.owner;
  store.owner = {
    email,
    tokens: {
      ...previous?.tokens,
      ...tokens,
      refresh_token: tokens.refresh_token ?? previous?.tokens.refresh_token ?? null,
    },
    connectedAt: previous?.connectedAt ?? new Date().toISOString(),
  };
  await persist();
}

export async function updateOwnerTokens(tokens: OAuthTokens): Promise<void> {
  const store = await load();
  if (!store.owner) return;
  store.owner.tokens = {
    ...store.owner.tokens,
    ...tokens,
    refresh_token: tokens.refresh_token ?? store.owner.tokens.refresh_token ?? null,
  };
  await persist();
}
