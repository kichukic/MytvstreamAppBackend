import { Router } from 'express';
import * as conversations from '../controllers/conversations.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const conversationsRoutes = Router();

conversationsRoutes.get('/conversations', requireAuth, conversations.list);
conversationsRoutes.get('/conversations/:userId/messages', requireAuth, conversations.messages);
conversationsRoutes.post('/conversations/:userId/messages', requireAuth, conversations.send);
conversationsRoutes.post('/conversations/:userId/read', requireAuth, conversations.markRead);
