import { Router } from 'express';
import { aiSearch } from '../controllers/ai.controller.js';

export const aiRoutes = Router();

aiRoutes.post('/ai/search', aiSearch);
