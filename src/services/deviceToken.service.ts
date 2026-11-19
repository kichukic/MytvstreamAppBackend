import type { Types } from 'mongoose';
import { DeviceToken } from '../models/deviceToken.model.js';

export async function register(user: Types.ObjectId, token: string, platform: string) {
  await DeviceToken.findOneAndUpdate(
    { user, token },
    { $set: { platform, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
}

export async function unregister(user: Types.ObjectId, token: string) {
  await DeviceToken.deleteOne({ user, token });
}

export async function tokensFor(user: Types.ObjectId): Promise<string[]> {
  const rows = await DeviceToken.find({ user }).lean();
  return rows.map((r) => r.token);
}

export async function tokensForUsers(users: Types.ObjectId[]): Promise<{ user: string; token: string }[]> {
  const rows = await DeviceToken.find({ user: { $in: users } }).lean();
  return rows.map((r) => ({ user: String(r.user), token: r.token }));
}
