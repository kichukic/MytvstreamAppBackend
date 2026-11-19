import type { Types } from 'mongoose';
import { Rating } from '../models/rating.model.js';
import { User } from '../models/user.model.js';

export async function rate(user: Types.ObjectId, body: { key: string; kind: string; title: string; poster?: string; stars: number; review?: string }) {
  const doc = await Rating.findOneAndUpdate(
    { user, key: body.key },
    { $set: { kind: body.kind, title: body.title, poster: body.poster, stars: body.stars, review: body.review, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true },
  );
  return doc;
}

export async function remove(user: Types.ObjectId, key: string) {
  await Rating.deleteOne({ user, key });
}

export async function listForTitle(key: string, limit = 20) {
  const rows = await Rating.find({ key }).sort({ updatedAt: -1 }).limit(limit).lean();
  const userIds = rows.map((r) => r.user);
  const users = await User.find({ _id: { $in: userIds } }).select('name').lean();
  const nameMap = new Map(users.map((u) => [String(u._id), u.name]));
  return rows.map((r) => ({
    user: String(r.user),
    userName: nameMap.get(String(r.user)) ?? 'Someone',
    key: r.key,
    kind: r.kind,
    title: r.title,
    poster: r.poster,
    stars: r.stars,
    review: r.review,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }));
}

export async function summary(key: string) {
  const agg = await Rating.aggregate([
    { $match: { key } },
    { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$stars' } } },
  ]);
  if (!agg.length) return { count: 0, average: 0 };
  return { count: agg[0].count, average: Math.round(agg[0].avg * 10) / 10 };
}

export async function listMine(user: Types.ObjectId) {
  const rows = await Rating.find({ user }).sort({ updatedAt: -1 }).lean();
  return rows.map((r) => ({
    user: String(r.user),
    key: r.key,
    kind: r.kind,
    title: r.title,
    poster: r.poster,
    stars: r.stars,
    review: r.review,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }));
}
