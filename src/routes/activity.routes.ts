import { Router } from 'express';
import * as activity from '../controllers/activity.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const activityRoutes = Router();

activityRoutes.get('/activity', requireAuth, activity.list);
activityRoutes.post('/activity', requireAuth, activity.merge);
activityRoutes.delete('/activity', requireAuth, activity.clear);
