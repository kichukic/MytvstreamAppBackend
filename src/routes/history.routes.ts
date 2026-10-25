import { Router } from 'express';
import * as history from '../controllers/history.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const historyRoutes = Router();

historyRoutes.get('/history', requireAuth, history.list);
historyRoutes.post('/history', requireAuth, history.merge);
historyRoutes.delete('/history', requireAuth, history.clear);
