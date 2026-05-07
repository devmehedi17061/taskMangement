import 'dotenv/config';
import app from './app.js';
import { bootstrapInstall } from './services/installService.js';

const port = Number(process.env.PORT) || 4000;

async function bootstrap(): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    console.error(
      '[bootstrap] No service-account credentials set — server cannot reach Google APIs. Set GOOGLE_SERVICE_ACCOUNT_KEY_JSON (Vercel) or GOOGLE_SERVICE_ACCOUNT_KEY_FILE (local).',
    );
    return;
  }
  try {
    await bootstrapInstall();
    console.log('[bootstrap] install complete');
  } catch (err) {
    console.error('[bootstrap] install failed:', err);
    console.error(
      '[bootstrap] Common causes: service-account JSON path is wrong, service account email is not shared on the resources you pinned in .env, or the Google Drive/Sheets/Docs APIs are not enabled on the GCP project.',
    );
  }
}

void bootstrap();

app.listen(port, () => {
  console.log(`drive-projects API listening on http://localhost:${port}`);
});
