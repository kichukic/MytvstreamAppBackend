import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { signInLimit } from '../middleware/rateLimit.middleware.js';

export const authRoutes = Router();

authRoutes.post('/auth/login', signInLimit, auth.login);
authRoutes.post('/auth/phone', signInLimit, auth.phoneLogin);
authRoutes.post('/auth/email', signInLimit, auth.emailLogin);
authRoutes.post('/auth/signup', signInLimit, auth.registerWithTicket);
authRoutes.get('/me', requireAuth, auth.getMe);
authRoutes.patch('/me', requireAuth, auth.updateMe);
authRoutes.post('/me/phone', requireAuth, signInLimit, auth.verifyPhone);
authRoutes.delete('/me/phone', requireAuth, auth.removePhone);
authRoutes.post('/me/email', requireAuth, signInLimit, auth.verifyEmail);
authRoutes.delete('/me/email', requireAuth, auth.removeEmail);
