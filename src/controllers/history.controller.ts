import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as historyService from '../services/history.service.js';
import { parse } from '../utils/validate.js';

const title = z.string().trim().min(1).max(300);

// The kinds of title kept: YouTube videos, live channels, and files in the
// person's own TorBox. Each comes with the key the app files it under.
const item = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('video'), videoId: z.string(), title }),
  z.object({ kind: z.literal('live'), channelId: z.string(), title }),
  z.object({
    kind: z.literal('file'),
    source: z.enum(['torrents', 'usenet', 'webdl']),
    itemId: z.number().int().nonnegative(),
    fileId: z.number().int().nonnegative(),
    title,
  }),
  z.object({
    kind: z.literal('moviebox'),
    subjectId: z.string(),
    season: z.number().int().nonnegative().optional(),
    episode: z.number().int().nonnegative().optional(),
    title,
    poster: z.string().optional(),
  }),
  z.object({
    kind: z.literal('stream'),
    url: z.string(),
    title,
    poster: z.string().optional(),
  }),
]);

type Item = z.infer<typeof item>;

function keyOf(i: Item): string {
  switch (i.kind) {
    case 'video':
      return `video:${i.videoId}`;
    case 'live':
      return `live:${i.channelId}`;
    case 'file':
      return `file:${i.source}:${i.itemId}:${i.fileId}`;
    case 'moviebox':
      return `moviebox:${i.subjectId}:${i.season ?? 0}:${i.episode ?? 0}`;
    case 'stream':
      return `stream:${i.url}`;
  }
}

const mergeBody = z.object({
  entries: z
    .array(z.object({ item, watchedAt: z.iso.datetime() }))
    .max(200, 'Too many at once.'),
});

export async function list(req: Request, res: Response) {
  res.json({ entries: await historyService.listHistory(currentUser(req)) });
}

export async function merge(req: Request, res: Response) {
  const { entries } = parse(mergeBody, req.body);
  // A time in the future (a phone with its clock ahead) counts as now.
  const now = Date.now();
  const incoming = entries.map((e) => ({
    key: keyOf(e.item),
    item: e.item,
    watchedAt: new Date(Math.min(Date.parse(e.watchedAt), now)),
  }));
  res.json({ entries: await historyService.mergeHistory(currentUser(req), incoming) });
}

export async function clear(req: Request, res: Response) {
  await historyService.clearHistory(currentUser(req));
  res.status(204).end();
}
