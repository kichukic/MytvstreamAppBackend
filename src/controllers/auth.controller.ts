import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as authService from '../services/auth.service.js';
import { emailSchema, parse, phoneSchema } from '../utils/validate.js';

const passwordSchema = z.string().min(8, 'Use at least 8 characters for the password.').max(200);

const registerBody = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Enter your name.').max(60),
  phone: phoneSchema.optional(),
});

const loginBody = z.object({ email: emailSchema, password: z.string().max(200) });

const updateBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  // An empty string removes the number.
  phone: z.union([phoneSchema, z.literal('')]).optional(),
});

export async function register(req: Request, res: Response) {
  res.status(201).json(await authService.register(parse(registerBody, req.body)));
}

export async function login(req: Request, res: Response) {
  const { email, password } = parse(loginBody, req.body);
  res.json(await authService.login(email, password));
}

export async function getMe(req: Request, res: Response) {
  res.json({ user: await authService.getProfile(currentUser(req)) });
}

export async function updateMe(req: Request, res: Response) {
  res.json({ user: await authService.updateProfile(currentUser(req), parse(updateBody, req.body)) });
}
