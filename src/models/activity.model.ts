import { Schema, model, type Types } from 'mongoose';

// On-device personalization events, mirrored to the account so they follow the
// person to a new phone or a reinstall. Stored as arrays per user, capped.
const activitySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Watch events: one per title, the latest time wins.
  watches: { type: [Schema.Types.Mixed], default: [] },
  // Search queries, newest first, capped.
  searches: { type: [Schema.Types.Mixed], default: [] },
  // Favorited titles.
  favorites: { type: [Schema.Types.Mixed], default: [] },
  // Downloaded titles.
  downloads: { type: [Schema.Types.Mixed], default: [] },
  // Opened titles (lightweight signal).
  opens: { type: [Schema.Types.Mixed], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

export const Activity = model('Activity', activitySchema);

export type ActivityDoc = {
  user: Types.ObjectId;
  watches: unknown[];
  searches: unknown[];
  favorites: unknown[];
  downloads: unknown[];
  opens: unknown[];
  updatedAt: Date;
};
