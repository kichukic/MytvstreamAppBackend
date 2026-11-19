import { Router } from 'express';
import * as rating from '../controllers/rating.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const ratingRoutes = Router();

ratingRoutes.get('/ratings', rating.forTitle);
ratingRoutes.get('/ratings/mine', requireAuth, rating.mine);
ratingRoutes.post('/ratings', requireAuth, rating.rate);
ratingRoutes.delete('/ratings/:key', requireAuth, rating.remove);
