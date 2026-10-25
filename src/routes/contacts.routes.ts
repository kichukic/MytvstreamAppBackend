import { Router } from 'express';
import * as contacts from '../controllers/contacts.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { contactsLimit } from '../middleware/rateLimit.middleware.js';

export const contactsRoutes = Router();

contactsRoutes.post('/contacts/match', requireAuth, contactsLimit, contacts.match);
