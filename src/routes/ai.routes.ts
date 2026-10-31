import { Router } from 'express';
import { aiSearch, aiTonight } from '../controllers/ai.controller.js';

export const aiRoutes = Router();

aiRoutes.post('/ai/search', aiSearch);
aiRoutes.post('/ai/tonight', aiTonight);
