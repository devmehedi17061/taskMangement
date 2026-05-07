import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createSession, deleteSession, getSession } from './store.js';

const COOKIE_NAME = 'dp_sid';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

function sign(value: string): string {
  const mac = crypto.createHmac('sha256', secret()).update(value).digest('hex');
  return `${value}.${mac}`;
}

function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf('.');
  if (dot < 0) return null;
  const value = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('hex');
  // timingSafeEqual requires same-length buffers
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export async function issueSession(res: Response, userId: string): Promise<void> {
  const sid = crypto.randomBytes(32).toString('hex');
  await createSession(sid, userId);
  res.cookie(COOKIE_NAME, sign(sid), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // localhost; flip to true behind HTTPS in production
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

export async function readSessionUserId(req: Request): Promise<string | null> {
  const raw = req.cookies?.[COOKIE_NAME] as string | undefined;
  const sid = unsign(raw);
  if (!sid) return null;
  const userId = await getSession(sid);
  return userId ?? null;
}

export async function clearSession(req: Request, res: Response): Promise<void> {
  const raw = req.cookies?.[COOKIE_NAME] as string | undefined;
  const sid = unsign(raw);
  if (sid) await deleteSession(sid);
  res.clearCookie(COOKIE_NAME, { path: '/' });
}
