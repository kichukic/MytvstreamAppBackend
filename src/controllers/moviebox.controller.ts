import type { Request, Response } from 'express';
import { z } from 'zod';
import * as movieboxService from '../services/moviebox.service.js';
import { parse } from '../utils/validate.js';

const body = z.object({
  subjectId: z.string().trim().min(1).max(64),
  season: z.number().int().nonnegative().default(0),
  episode: z.number().int().nonnegative().default(0),
});

export async function resolve(req: Request, res: Response) {
  const data = parse(body, req.body);
  const result = await movieboxService.resolveStream(data.subjectId, data.season, data.episode);
  if (!result) {
    res.status(404).json({ error: 'No stream found' });
    return;
  }
  res.json(result);
}
