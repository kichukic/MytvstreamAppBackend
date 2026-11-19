import { History } from '../models/history.model.js';

// Trending: most-watched titles across all users in the last N days.
// Aggregates from the History collection (YouTube/live/file/moviebox/stream)
// which already records every watch with a time. Activity is per-user and
// heavier; history is the lighter, cross-user signal.
const WINDOW_DAYS = 7;
const MAX_RESULTS = 30;

export async function trending(limit = MAX_RESULTS) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await History.aggregate([
    { $match: { watchedAt: { $gte: since } } },
    { $group: { _id: '$key', item: { $first: '$item' }, count: { $sum: 1 }, lastWatched: { $max: '$watchedAt' } } },
    { $sort: { count: -1, lastWatched: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ key: r._id, item: r.item, count: r.count }));
}
