import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as authService from '../services/auth.service.js';
import { emailSchema, parse } from '../utils/validate.js';

const nameSchema = z.string().trim().min(1, 'Enter your name.').max(60);
// What Phone.Email's page gives the app: an access token for a phone, a link
// to the result for an email.
const accessTokenSchema = z.string().trim().min(1, 'Verify first.').max(2000);
const resultUrlSchema = z.string().trim().min(1, 'Verify first.').max(500);

const loginBody = z.object({ email: emailSchema, password: z.string().max(200) });
const phoneBody = z.object({ accessToken: accessTokenSchema });
const emailBody = z.object({ resultUrl: resultUrlSchema });
const ticketBody = z.object({ ticket: z.string().max(2000), name: nameSchema });
const updateBody = z.object({ name: nameSchema });
// A data URI for a picture already cropped and compressed by the app. The
// router's 3 MB body limit and updateAvatar's decoded-size check handle the
// size; this only has to allow null to remove the picture.
const avatarBody = z.object({ avatar: z.string().nullable() });

export async function login(req: Request, res: Response) {
  const { email, password } = parse(loginBody, req.body);
  res.json(await authService.login(email, password));
}

export async function phoneLogin(req: Request, res: Response) {
  res.json(await authService.phoneLogin(parse(phoneBody, req.body).accessToken));
}

export async function emailLogin(req: Request, res: Response) {
  res.json(await authService.emailLogin(parse(emailBody, req.body).resultUrl));
}

export async function registerWithTicket(req: Request, res: Response) {
  const { ticket, name } = parse(ticketBody, req.body);
  res.status(201).json(await authService.registerWithTicket(ticket, name));
}

export async function getMe(req: Request, res: Response) {
  res.json({ user: await authService.getProfile(currentUser(req)) });
}

export async function updateMe(req: Request, res: Response) {
  res.json({ user: await authService.updateName(currentUser(req), parse(updateBody, req.body).name) });
}

export async function updateAvatar(req: Request, res: Response) {
  const { avatar } = parse(avatarBody, req.body);
  res.json({ user: await authService.updateAvatar(currentUser(req), avatar) });
}

/** Someone's picture, at the short URL publicUser gives out. */
export async function getAvatar(req: Request, res: Response) {
  const { userId } = parse(z.object({ userId: z.string() }), req.params);
  if (!Types.ObjectId.isValid(userId)) {
    res.status(404).json({ error: 'No picture.' });
    return;
  }
  const picture = await authService.getAvatarBytes(new Types.ObjectId(userId));
  if (!picture) {
    res.status(404).json({ error: 'No picture.' });
    return;
  }
  // The URL carries a version, so the bytes never change behind it.
  res.setHeader('Content-Type', picture.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(picture.bytes);
}

export async function verifyPhone(req: Request, res: Response) {
  const { accessToken } = parse(phoneBody, req.body);
  res.json({ user: await authService.verifyPhone(currentUser(req), accessToken) });
}

export async function verifyEmail(req: Request, res: Response) {
  const { resultUrl } = parse(emailBody, req.body);
  res.json({ user: await authService.verifyEmail(currentUser(req), resultUrl) });
}

export async function removePhone(req: Request, res: Response) {
  res.json({ user: await authService.removePhone(currentUser(req)) });
}

export async function removeEmail(req: Request, res: Response) {
  res.json({ user: await authService.removeEmail(currentUser(req)) });
}
