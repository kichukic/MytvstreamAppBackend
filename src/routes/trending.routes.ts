import { Router } from 'express';
import * as trending from '../controllers/trending.controller.js';

export const trendingRoutes = Router();
trendingRoutes.get('/trending', trending.list);
