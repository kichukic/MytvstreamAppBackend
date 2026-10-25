import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as conversationsService from '../services/conversations.service.js';
import { objectId, parse } from '../utils/validate.js';

const pageQuery = z.object({ before: z.iso.datetime().optional() });

const sendBody = z
  .object({
    text: z.string().trim().max(4000).optional(),
    // A ForUs title (a YouTube film or episode) shared as a card.
    title: z
      .object({
        kind: z.literal('video'),
        videoId: z.string().regex(/^[\w-]{11}$/, 'Invalid video.'),
        title: z.string().trim().min(1).max(300),
      })
      .optional(),
  })
  .refine((b) => !!b.text || !!b.title, 'Type a message.');

export async function list(req: Request, res: Response) {
  res.json({ conversations: await conversationsService.listConversations(currentUser(req)) });
}

export async function messages(req: Request, res: Response) {
  const { before } = parse(pageQuery, req.query);
  const other = objectId(req.params.userId, 'user');
  res.json(await conversationsService.listMessages(currentUser(req), other, before ? new Date(before) : undefined));
}

export async function send(req: Request, res: Response) {
  const content = parse(sendBody, req.body);
  const message = await conversationsService.sendMessage(currentUser(req), objectId(req.params.userId, 'user'), content);
  res.status(201).json({ message });
}

export async function markRead(req: Request, res: Response) {
  await conversationsService.markRead(currentUser(req), objectId(req.params.userId, 'user'));
  res.status(204).end();
}
