/**
 * Per-spreadsheet write serialization with retry on 429/5xx.
 * Reads do not need this — they are independent and Google handles caching.
 */

const tails = new Map<string, Promise<unknown>>();

const RETRY_DELAYS_MS = [500, 1500, 4000];

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: number; status?: number }).code
    ?? (err as { response?: { status?: number } }).response?.status;
  if (typeof code === 'number') {
    if (code === 429) return true;
    if (code >= 500 && code < 600) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (attempt === RETRY_DELAYS_MS.length || !isTransient(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }
  throw lastErr;
}

export function runOnSheet<T>(spreadsheetId: string, op: () => Promise<T>): Promise<T> {
  const prev = tails.get(spreadsheetId) ?? Promise.resolve();
  const next = prev.then(() => withRetry(op));
  // Keep the queue going even if this op rejects; downstream waiters should still proceed.
  tails.set(
    spreadsheetId,
    next.catch(() => undefined),
  );
  return next;
}
