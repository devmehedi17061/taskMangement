import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../server/src/app.js';
import { bootstrapInstall } from '../server/src/services/installService.js';

let bootstrapPromise: Promise<void> | null = null;

function ensureBootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON &&
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
    ) {
      console.error(
        '[bootstrap] No Google service-account creds set — set GOOGLE_SERVICE_ACCOUNT_KEY_JSON in Vercel env.',
      );
      return;
    }
    try {
      await bootstrapInstall();
      console.log('[bootstrap] install complete');
    } catch (err) {
      console.error('[bootstrap] install failed:', err);
      // Don't cache failures — let the next request retry.
      bootstrapPromise = null;
      throw err;
    }
  })();
  return bootstrapPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    await ensureBootstrap();
  } catch (err) {
    console.error('[handler] bootstrap error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error:
          'Server bootstrap failed. Check GOOGLE_SERVICE_ACCOUNT_KEY_JSON and the Drive resource ids on Vercel.',
      }),
    );
    return;
  }
  // Express's app is itself a (req, res) handler.
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
