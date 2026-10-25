import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as friendsService from '../services/friends.service.js';
import { emailSchema, objectId, parse, phoneSchema } from '../utils/validate.js';

// Someone by email or phone: ?email=… or ?phone=…
const lookupQuery = z.union([z.object({ email: emailSchema }), z.object({ phone: phoneSchema })]);

export async function lookUp(req: Request, res: Response) {
  res.json(await friendsService.lookUp(currentUser(req), parse(lookupQuery, req.query)));
}

export async function list(req: Request, res: Response) {
  res.json(await friendsService.listFriends(currentUser(req)));
}

export async function sendRequest(req: Request, res: Response) {
  const { userId } = parse(z.object({ userId: z.string() }), req.body);
  const result = await friendsService.sendRequest(currentUser(req), objectId(userId, 'user'));
  res.status(result.status === 'requested' ? 201 : 200).json(result);
}

export async function acceptRequest(req: Request, res: Response) {
  await friendsService.acceptRequest(currentUser(req), objectId(req.params.id, 'request'));
  res.json({ status: 'friends' });
}

export async function dropRequest(req: Request, res: Response) {
  await friendsService.dropRequest(currentUser(req), objectId(req.params.id, 'request'));
  res.status(204).end();
}

export async function unfriend(req: Request, res: Response) {
  await friendsService.unfriend(currentUser(req), objectId(req.params.userId, 'user'));
  res.status(204).end();
}
