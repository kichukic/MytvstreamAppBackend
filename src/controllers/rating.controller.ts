import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as ratingService from '../services/rating.service.js';
import { parse } from '../utils/validate.js';

const body = z.object({
  key: z.string().trim().min(1).max(200),
  kind: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(300),
  poster: z.string().max(500).optional(),
  stars: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
});

export async function rate(req: Request, res: Response) {
  const data = parse(body, req.body);
  res.json(await ratingService.rate(currentUser(req), data));
}

export async function remove(req: Request, res: Response) {
  const key = z.string().trim().min(1).max(200).parse(req.params.key);
  await ratingService.remove(currentUser(req), key);
  res.status(204).end();
}

export async function forTitle(req: Request, res: Response) {
  const key = z.string().trim().min(1).max(200).parse(req.query.key);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const [entries, summary] = await Promise.all([ratingService.listForTitle(key, limit), ratingService.summary(key)]);
  res.json({ entries, summary });
}

export async function mine(req: Request, res: Response) {
  res.json({ entries: await ratingService.listMine(currentUser(req)) });
}
