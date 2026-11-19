import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as deviceTokenService from '../services/deviceToken.service.js';
import { parse } from '../utils/validate.js';

const body = z.object({
  token: z.string().trim().min(10).max(500),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
});

export async function register(req: Request, res: Response) {
  const data = parse(body, req.body);
  await deviceTokenService.register(currentUser(req), data.token, data.platform);
  res.status(204).end();
}

export async function unregister(req: Request, res: Response) {
  const token = z.string().trim().min(10).max(500).parse(req.body?.token);
  await deviceTokenService.unregister(currentUser(req), token);
  res.status(204).end();
}
