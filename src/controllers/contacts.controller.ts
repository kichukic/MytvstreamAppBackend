import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.middleware.js';
import * as contactsService from '../services/contacts.service.js';
import { parse } from '../utils/validate.js';

// A phone's whole contact list at once; a few thousand is plenty.
const MAX_ENTRIES = 3000;

const matchBody = z.object({
  phones: z.array(z.string().max(40)).max(MAX_ENTRIES).default([]),
  emails: z.array(z.string().max(254)).max(MAX_ENTRIES).default([]),
});

export async function match(req: Request, res: Response) {
  res.json({ matches: await contactsService.matchContacts(currentUser(req), parse(matchBody, req.body)) });
}
