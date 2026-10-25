// Watch history kept on the server. Devices send what was watched and when;
// for each title the latest time wins, and everyone keeps their newest few
// hundred titles.
import type { Types } from 'mongoose';
import { History, publicEntry } from '../models/history.model.js';

const MAX_ITEMS = 200;

export type IncomingEntry = { key: string; item: Record<string, unknown>; watchedAt: Date };

export async function listHistory(user: Types.ObjectId) {
  const rows = await History.find({ user }).sort({ watchedAt: -1 }).limit(MAX_ITEMS).lean();
  return rows.map(publicEntry);
}

/** Adds or updates entries (keeping the later time), and returns the whole history. */
export async function mergeHistory(user: Types.ObjectId, entries: IncomingEntry[]) {
  if (entries.length) {
    await History.bulkWrite(
      entries.map((e) => ({
        updateOne: {
          filter: { user, key: e.key },
          // $max keeps whichever time is later, the stored one or this one; the
          // title's details are refreshed only when this one is the newer.
          update: { $max: { watchedAt: e.watchedAt }, $setOnInsert: { item: e.item } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    // Newer details (a renamed title) replace older ones.
    await History.bulkWrite(
      entries.map((e) => ({
        updateOne: { filter: { user, key: e.key, watchedAt: e.watchedAt }, update: { $set: { item: e.item } } },
      })),
      { ordered: false },
    );
    await trim(user);
  }
  return listHistory(user);
}

// Drops everything past the newest MAX_ITEMS.
async function trim(user: Types.ObjectId) {
  const cutoff = await History.find({ user }).sort({ watchedAt: -1 }).skip(MAX_ITEMS).limit(1).lean();
  if (cutoff[0]) await History.deleteMany({ user, watchedAt: { $lte: cutoff[0].watchedAt } });
}

export async function clearHistory(user: Types.ObjectId) {
  await History.deleteMany({ user });
}
