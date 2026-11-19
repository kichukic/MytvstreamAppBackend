import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as activityService from '../services/activity.service.js';
import { parse } from '../utils/validate.js';

const entry = z.record(z.string(), z.unknown());

const mergeBody = z.object({
  watches: z.array(entry).max(400).optional(),
  searches: z.array(entry).max(200).optional(),
  favorites: z.array(entry).max(500).optional(),
  downloads: z.array(entry).max(500).optional(),
  opens: z.array(entry).max(600).optional(),
});

export async function list(req: Request, res: Response) {
  res.json(await activityService.getActivity(currentUser(req)));
}

export async function merge(req: Request, res: Response) {
  const body = parse(mergeBody, req.body);
  res.json(await activityService.mergeActivity(currentUser(req), body));
}

export async function clear(req: Request, res: Response) {
  await activityService.clearActivity(currentUser(req));
  res.status(204).end();
}
