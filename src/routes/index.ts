import { Router } from 'express';
import mongoose from 'mongoose';
import { aiRoutes } from './ai.routes.js';
import { authRoutes } from './auth.routes.js';
import { contactsRoutes } from './contacts.routes.js';
import { conversationsRoutes } from './conversations.routes.js';
import { friendsRoutes } from './friends.routes.js';
import { deviceTokenRoutes } from './deviceToken.routes.js';
import { historyRoutes } from './history.routes.js';
import { movieboxRoutes } from './moviebox.routes.js';
import { ratingRoutes } from './rating.routes.js';
import { trendingRoutes } from './trending.routes.js';
import { activityRoutes } from './activity.routes.js';
import { adminRoutes } from './admin.routes.js';
import { bannerRoutes } from './banner.routes.js';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});
routes.use(aiRoutes);
routes.use(authRoutes);
routes.use(friendsRoutes);
routes.use(conversationsRoutes);
routes.use(deviceTokenRoutes);
routes.use(historyRoutes);
routes.use(movieboxRoutes);
routes.use(ratingRoutes);
routes.use(trendingRoutes);
routes.use(activityRoutes);
routes.use(contactsRoutes);
routes.use(adminRoutes);
routes.use(bannerRoutes);
