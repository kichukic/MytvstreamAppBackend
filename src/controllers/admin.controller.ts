import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware.js';
import { HttpError } from '../utils/httpError.js';
import { User } from '../models/user.model.js';
import { getOnlineUsersMap } from '../services/realtime.service.js';

export async function getAnalytics(req: Request, res: Response) {
  const me = await User.findById(currentUser(req));
  if (!me?.isAdmin && !(me as any)?.isadmin) {
    throw new HttpError(403, 'Forbidden: Admin access required');
  }

  const users = await User.find(
    {},
    'name email phone isAdmin isadmin screenTimeSeconds lastActiveAt createdAt',
  )
    .sort({ screenTimeSeconds: -1 })
    .lean();

  const onlineMap = getOnlineUsersMap();
  const now = Date.now();

  const formatted = users.map((u) => {
    const isOnline = onlineMap.has(u._id.toString());
    const onlineData = onlineMap.get(u._id.toString());
    const sessionSeconds = isOnline && onlineData ? Math.floor((now - onlineData.connectedAt) / 1000) : 0;
    return {
      id: u._id.toString(),
      name: u.name,
      email: u.email ?? undefined,
      phone: u.phone ?? undefined,
      isAdmin: !!(u.isAdmin || (u as any).isadmin),
      online: isOnline,
      currentSessionSeconds: sessionSeconds,
      totalScreenTimeSeconds: (u.screenTimeSeconds ?? 0) + sessionSeconds,
      lastActiveAt: u.lastActiveAt ?? u.createdAt,
      joinedAt: u.createdAt,
    };
  });

  const onlineList = formatted.filter((u) => u.online);
  const totalScreenTime = formatted.reduce((sum, u) => sum + u.totalScreenTimeSeconds, 0);

  res.json({
    onlineCount: onlineList.length,
    totalUsers: formatted.length,
    totalScreenTimeSeconds: totalScreenTime,
    onlineUsers: onlineList,
    users: formatted,
  });
}

export async function recordHeartbeat(req: Request, res: Response) {
  const sec = Math.min(300, Math.max(1, Number(req.body?.seconds) || 30));
  await User.findByIdAndUpdate(currentUser(req), {
    $inc: { screenTimeSeconds: sec },
    $set: { lastActiveAt: new Date() },
  });
  res.json({ ok: true });
}
