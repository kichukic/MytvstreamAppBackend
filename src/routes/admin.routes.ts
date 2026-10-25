import { Router } from 'express';
import { getAnalytics, recordHeartbeat } from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const adminRoutes = Router();

// Endpoint for users to report active screen time (runs periodically from client)
adminRoutes.post('/analytics/heartbeat', requireAuth, recordHeartbeat);

// Endpoint for admin dashboard
adminRoutes.get('/admin/analytics', requireAuth, getAnalytics);
