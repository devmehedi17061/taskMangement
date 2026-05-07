import type { IncomingMessage, ServerResponse } from 'node:http';

type ExpressLike = (req: IncomingMessage, res: ServerResponse) => void;

let appPromise: Promise<ExpressLike> | null = null;

async function loadApp(): Promise<ExpressLike> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    // Dynamic imports so any module-load error is catchable instead of
    // taking the whole runtime down with a FUNCTION_INVOCATION_FAILED.
    const [appModule, installModule] = await Promise.all([
      import('../server/src/app.js'),
      import('../server/src/services/installService.js'),
    ]);
    const app = appModule.default as ExpressLike;
    const { bootstrapInstall } = installModule;

    const hasCreds =
      !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON ||
      !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

    if (hasCreds) {
      try {
        await bootstrapInstall();
        console.log('[bootstrap] install complete');
      } catch (err) {
        // Don't fail the cold start over a bootstrap error — Express can still
        // serve /api/health and individual route handlers will surface real
        // errors from there.
        console.error('[bootstrap] install failed:', err);
      }
    } else {
      console.warn(
        '[bootstrap] No Google service-account creds set — set GOOGLE_SERVICE_ACCOUNT_KEY_JSON in Vercel env.',
      );
    }
    return app;
  })().catch((err) => {
    // Reset so the next request can retry the import.
    appPromise = null;
    throw err;
  });
  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const app = await loadApp();
    return app(req, res);
  } catch (err) {
    console.error('[handler] fatal error', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Server error',
        }),
      );
    } else {
      try {
        res.end();
      } catch {
        // already closed
      }
    }
  }
}
