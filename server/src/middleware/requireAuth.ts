import type { NextFunction, Request, Response } from 'express';
import { readSessionUserId } from '../session.js';
import { httpError } from '../lib/httpError.js';

export interface AuthedRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await readSessionUserId(req);
    if (!userId) {
      next(httpError(401, 'Not authenticated'));
      return;
    }
    (req as AuthedRequest).userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
