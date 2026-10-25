import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { verifyToken } from '../utils/token.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: Types.ObjectId;
  }
}

/** Lets a request through only with a valid `Authorization: Bearer <token>`. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const userId = verifyToken(header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!userId || !Types.ObjectId.isValid(userId)) {
    res.status(401).json({ error: 'Sign in again.' });
    return;
  }
  req.userId = new Types.ObjectId(userId);
  next();
}

/** The signed-in user's id, on a route behind requireAuth. */
export function currentUser(req: Request): Types.ObjectId {
  return req.userId!;
}
