import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { signInLimit } from '../middleware/rateLimit.middleware.js';

export const authRoutes = Router();

authRoutes.post('/auth/register', signInLimit, auth.register);
authRoutes.post('/auth/login', signInLimit, auth.login);
authRoutes.get('/me', requireAuth, auth.getMe);
authRoutes.patch('/me', requireAuth, auth.updateMe);
