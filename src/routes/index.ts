import { Router } from 'express';
import mongoose from 'mongoose';
import { aiRoutes } from './ai.routes.js';
import { authRoutes } from './auth.routes.js';
import { contactsRoutes } from './contacts.routes.js';
import { conversationsRoutes } from './conversations.routes.js';
import { friendsRoutes } from './friends.routes.js';
import { historyRoutes } from './history.routes.js';
import { adminRoutes } from './admin.routes.js';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});
routes.use(aiRoutes);
routes.use(authRoutes);
routes.use(friendsRoutes);
routes.use(conversationsRoutes);
routes.use(historyRoutes);
routes.use(contactsRoutes);
routes.use(adminRoutes);
