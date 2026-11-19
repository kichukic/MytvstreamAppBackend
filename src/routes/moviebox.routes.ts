import { Router } from 'express';
import * as moviebox from '../controllers/moviebox.controller.js';

export const movieboxRoutes = Router();
movieboxRoutes.post('/moviebox/resolve', moviebox.resolve);
