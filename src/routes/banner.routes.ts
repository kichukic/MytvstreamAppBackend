import { Router } from 'express';
import {
  getBlockedBanners,
  blockBanner,
  unblockBanner,
  listBlockedBannersAdmin,
} from '../controllers/banner.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const bannerRoutes = Router();

// Public: allows all clients (guest and authenticated) to fetch globally blocked banners
bannerRoutes.get('/banners/blocked', getBlockedBanners);

// Admin-only endpoints
bannerRoutes.post('/admin/banners/block', requireAuth, blockBanner);
bannerRoutes.delete('/admin/banners/block/:videoId', requireAuth, unblockBanner);
bannerRoutes.get('/admin/banners/blocked', requireAuth, listBlockedBannersAdmin);
