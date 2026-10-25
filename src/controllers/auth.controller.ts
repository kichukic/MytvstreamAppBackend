import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as authService from '../services/auth.service.js';
import { emailSchema, parse } from '../utils/validate.js';

const passwordSchema = z.string().min(8, 'Use at least 8 characters for the password.').max(200);
const nameSchema = z.string().trim().min(1, 'Enter your name.').max(60);
// The token Phone.Email's sign-in page gives the app.
const accessTokenSchema = z.string().trim().min(1, 'Verify your number first.').max(2000);

const registerBody = z.object({ email: emailSchema, password: passwordSchema, name: nameSchema });
const loginBody = z.object({ email: emailSchema, password: z.string().max(200) });
const phoneBody = z.object({ accessToken: accessTokenSchema });
const phoneRegisterBody = z.object({ ticket: z.string().max(2000), name: nameSchema });
const updateBody = z.object({ name: nameSchema });

export async function register(req: Request, res: Response) {
  res.status(201).json(await authService.register(parse(registerBody, req.body)));
}

export async function login(req: Request, res: Response) {
  const { email, password } = parse(loginBody, req.body);
  res.json(await authService.login(email, password));
}

export async function phoneLogin(req: Request, res: Response) {
  res.json(await authService.phoneLogin(parse(phoneBody, req.body).accessToken));
}

export async function phoneRegister(req: Request, res: Response) {
  const { ticket, name } = parse(phoneRegisterBody, req.body);
  res.status(201).json(await authService.phoneRegister(ticket, name));
}

export async function getMe(req: Request, res: Response) {
  res.json({ user: await authService.getProfile(currentUser(req)) });
}

export async function updateMe(req: Request, res: Response) {
  res.json({ user: await authService.updateName(currentUser(req), parse(updateBody, req.body).name) });
}

export async function verifyPhone(req: Request, res: Response) {
  const { accessToken } = parse(phoneBody, req.body);
  res.json({ user: await authService.verifyPhone(currentUser(req), accessToken) });
}

export async function removePhone(req: Request, res: Response) {
  res.json({ user: await authService.removePhone(currentUser(req)) });
}
