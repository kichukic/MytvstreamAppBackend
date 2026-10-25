import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware.js';
import { HttpError } from '../utils/httpError.js';
import { User } from '../models/user.model.js';
import { BlockedBanner } from '../models/blockedBanner.model.js';

// Public endpoint: returns list of videoIds blocked globally by admin
export async function getBlockedBanners(_req: Request, res: Response) {
  const items = await BlockedBanner.find({}, 'videoId title channel createdAt').lean();
  const blockedVideoIds = items.map((b) => b.videoId);
  res.json({ ok: true, blockedVideoIds, items });
}

// Admin endpoint: block a banner globally for all users
export async function blockBanner(req: Request, res: Response) {
  const me = await User.findById(currentUser(req));
  if (!me || (!me.isAdmin && !(me as any)?.isadmin)) {
    throw new HttpError(403, 'Forbidden: Admin access required');
  }

  const { videoId, title, channel } = req.body ?? {};
  if (!videoId || typeof videoId !== 'string') {
    throw new HttpError(400, 'videoId is required');
  }

  const cleanId = videoId.trim();
  const updated = await BlockedBanner.findOneAndUpdate(
    { videoId: cleanId },
    {
      videoId: cleanId,
      title: typeof title === 'string' ? title.trim() : undefined,
      channel: typeof channel === 'string' ? channel.trim() : undefined,
      blockedBy: me._id,
      blockedByName: me.name,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.json({ ok: true, item: updated });
}

// Admin endpoint: unblock a banner globally
export async function unblockBanner(req: Request, res: Response) {
  const me = await User.findById(currentUser(req));
  if (!me || (!me.isAdmin && !(me as any)?.isadmin)) {
    throw new HttpError(403, 'Forbidden: Admin access required');
  }

  const rawId = req.params.videoId;
  const videoId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!videoId || typeof videoId !== 'string') {
    throw new HttpError(400, 'videoId is required');
  }

  await BlockedBanner.deleteOne({ videoId: videoId.trim() });
  res.json({ ok: true });
}

// Admin endpoint: detailed list of blocked banners
export async function listBlockedBannersAdmin(req: Request, res: Response) {
  const me = await User.findById(currentUser(req));
  if (!me || (!me.isAdmin && !(me as any)?.isadmin)) {
    throw new HttpError(403, 'Forbidden: Admin access required');
  }

  const items = await BlockedBanner.find().sort({ createdAt: -1 }).lean();
  res.json({ ok: true, items });
}
