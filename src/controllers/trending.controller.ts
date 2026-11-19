import type { Request, Response } from 'express';
import * as trendingService from '../services/trending.service.js';

export async function list(req: Request, res: Response) {
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  res.json({ entries: await trendingService.trending(limit) });
}
