import { Router } from 'express';
import * as deviceToken from '../controllers/deviceToken.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const deviceTokenRoutes = Router();
deviceTokenRoutes.post('/devices', requireAuth, deviceToken.register);
deviceTokenRoutes.delete('/devices', requireAuth, deviceToken.unregister);
