import express, { Router } from 'express';
import * as conversations from '../controllers/conversations.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const conversationsRoutes = Router();

conversationsRoutes.get('/conversations', requireAuth, conversations.list);
conversationsRoutes.get('/conversations/:userId/messages', requireAuth, conversations.messages);
conversationsRoutes.post('/conversations/:userId/messages', requireAuth, conversations.send);
conversationsRoutes.post('/conversations/:userId/read', requireAuth, conversations.markRead);

// Voice messages: the recording is sent as raw audio (up to 3 MB, about ten
// minutes), held until the friend's phone collects it, then deleted.
const voiceBody = express.raw({ type: 'audio/*', limit: '3mb' });
conversationsRoutes.post('/conversations/:userId/voice', requireAuth, voiceBody, conversations.sendVoice);
conversationsRoutes.get('/voice/:messageId', requireAuth, conversations.getVoice);
conversationsRoutes.delete('/voice/:messageId', requireAuth, conversations.voiceReceived);
