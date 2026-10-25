// Sign-in tokens. The app keeps one after signing in and sends it with every
// request, and when the chat socket connects.
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

/** The user id in a token, or null if it is missing, expired or forged. */
export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
