import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as conversationsService from '../services/conversations.service.js';
import { objectId, parse } from '../utils/validate.js';

const pageQuery = z.object({ before: z.iso.datetime().optional() });

const titleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('video'),
    videoId: z.string().max(50),
    title: z.string().trim().min(1).max(300),
  }),
  z.object({
    kind: z.literal('web'),
    url: z.string().max(2000),
    title: z.string().trim().min(1).max(300),
    poster: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('stream'),
    url: z.string().max(2000),
    title: z.string().trim().min(1).max(300),
    poster: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('movie'),
    id: z.string().max(100),
    title: z.string().trim().min(1).max(300),
    poster: z.string().max(2000).optional(),
    year: z.string().max(20).optional(),
  }),
  z.object({
    kind: z.literal('moviebox'),
    subjectId: z.string().max(50),
    season: z.number().int().nonnegative().optional(),
    episode: z.number().int().nonnegative().optional(),
    title: z.string().trim().min(1).max(300),
    poster: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('file'),
    source: z.string().max(20),
    itemId: z.number().int(),
    fileId: z.number().int(),
    title: z.string().trim().min(1).max(300),
  }),
]);

const sendBody = z
  .object({
    text: z.string().trim().max(4000).optional(),
    title: titleSchema.optional(),
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

// A voice message arrives as the raw recording (see the route), with its
// length in ?durationMs. Phones record AAC in an MP4/M4A file.
const VOICE_TYPES = new Set(['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/webm']);
const voiceQuery = z.object({ durationMs: z.coerce.number().int().min(300, 'Too short.').max(15 * 60 * 1000, 'Too long.') });

export async function sendVoice(req: Request, res: Response) {
  const { durationMs } = parse(voiceQuery, req.query);
  const mime = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  const data = req.body;
  if (!VOICE_TYPES.has(mime) || !Buffer.isBuffer(data) || data.length < 512) {
    res.status(400).json({ error: "That recording couldn't be sent." });
    return;
  }
  const message = await conversationsService.sendMessage(currentUser(req), objectId(req.params.userId, 'user'), {
    voice: { durationMs, mime, data },
  });
  res.status(201).json({ message });
}

export async function getVoice(req: Request, res: Response) {
  const clip = await conversationsService.getVoiceClip(currentUser(req), objectId(req.params.messageId, 'message'));
  if (!clip) {
    res.status(404).json({ error: 'This voice message is no longer available.' });
    return;
  }
  res.type(clip.mime).send(Buffer.from(clip.data.buffer ?? clip.data));
}

export async function voiceReceived(req: Request, res: Response) {
  await conversationsService.voiceClipReceived(currentUser(req), objectId(req.params.messageId, 'message'));
  res.status(204).end();
}
