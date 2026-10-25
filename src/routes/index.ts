import { Router } from 'express';
import mongoose from 'mongoose';
import { authRoutes } from './auth.routes.js';
import { conversationsRoutes } from './conversations.routes.js';
import { friendsRoutes } from './friends.routes.js';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});
routes.use(authRoutes);
routes.use(friendsRoutes);
routes.use(conversationsRoutes);
