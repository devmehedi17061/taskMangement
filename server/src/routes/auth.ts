import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { clearSession, issueSession, readSessionUserId } from '../session.js';
import {
  appendUser as appendUserToSheet,
  findUserByEmail as findUserInSheet,
  findUserById,
} from '../services/usersSheetService.js';
import {
  exchangeOwnerCode,
  getOwnerAuthUrl,
  getOwnerEmail,
  invalidateOwnerCache,
} from '../lib/ownerClient.js';
import { getOwner, saveOwner } from '../store.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
const MAX_NAME_LEN = 80;

router.post('/register', async (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!name || name.length > MAX_NAME_LEN) {
    res.status(400).json({ error: `Name is required (max ${MAX_NAME_LEN} chars)` });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }
  if (password.length < MIN_PASSWORD_LEN) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters` });
    return;
  }

  try {
    const existing = await findUserInSheet(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const id = `local_${uuidv4()}`;
    const createdAt = new Date().toISOString();

    await appendUserToSheet({ id, name, email, passwordHash, createdAt });
    await issueSession(res, id);
    res.json({ user: { id, email, name } });
  } catch (err) {
    console.error('[auth/register]', err);
    const detail = err instanceof Error ? err.message : 'Registration failed';
    res.status(500).json({ error: `Registration failed: ${detail}` });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!EMAIL_RE.test(email) || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const row = await findUserInSheet(email);
    if (!row || !row.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    await issueSession(res, row.id);
    res.json({ user: { id: row.id, email: row.email, name: row.name } });
  } catch (err) {
    console.error('[auth/login]', err);
    const detail = err instanceof Error ? err.message : 'Login failed';
    res.status(500).json({ error: `Login failed: ${detail}` });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  const userId = await readSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await findUserById(userId);
  if (!user) {
    res.status(401).json({ error: 'Session points to unknown user' });
    return;
  }
  const owner = await getOwner();
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    owner: owner
      ? { connected: true, email: owner.email }
      : { connected: false },
  });
});

router.post('/logout', async (req: Request, res: Response) => {
  await clearSession(req, res);
  res.json({ ok: true });
});

router.get('/google', async (req: Request, res: Response) => {
  const userId = await readSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const url = getOwnerAuthUrl();
    res.redirect(url);
  } catch (err) {
    console.error('[auth/google]', err);
    const detail = err instanceof Error ? err.message : 'OAuth setup failed';
    res.status(500).json({ error: detail });
  }
});

router.get('/callback', async (req: Request, res: Response) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const errorParam = typeof req.query.error === 'string' ? req.query.error : '';
  if (errorParam) {
    res.redirect(`${clientOrigin}/projects?gerror=${encodeURIComponent(errorParam)}`);
    return;
  }
  if (!code) {
    res.redirect(`${clientOrigin}/projects?gerror=missing_code`);
    return;
  }
  try {
    const { client, tokens } = await exchangeOwnerCode(code);
    const email = await getOwnerEmail(client);
    if (!email) throw new Error('Could not resolve Google account email');
    await saveOwner(email, {
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expiry_date: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
      id_token: tokens.id_token ?? null,
    });
    invalidateOwnerCache();
    res.redirect(`${clientOrigin}/projects?gconnected=1`);
  } catch (err) {
    console.error('[auth/callback]', err);
    const detail = err instanceof Error ? err.message : 'OAuth callback failed';
    res.redirect(`${clientOrigin}/projects?gerror=${encodeURIComponent(detail)}`);
  }
});

export default router;
