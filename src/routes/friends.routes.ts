import { Router } from 'express';
import * as friends from '../controllers/friends.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { lookupLimit } from '../middleware/rateLimit.middleware.js';

export const friendsRoutes = Router();

friendsRoutes.get('/users/lookup', requireAuth, lookupLimit, friends.lookUp);
friendsRoutes.get('/friends', requireAuth, friends.list);
friendsRoutes.post('/friends/requests', requireAuth, friends.sendRequest);
friendsRoutes.post('/friends/requests/:id/accept', requireAuth, friends.acceptRequest);
friendsRoutes.delete('/friends/requests/:id', requireAuth, friends.dropRequest);
friendsRoutes.delete('/friends/:userId', requireAuth, friends.unfriend);
