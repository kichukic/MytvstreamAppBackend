import { Schema, model, type Types } from 'mongoose';

// What someone watched, so it follows them to a new phone or a reinstall. One
// record per title per person; watching again moves its time forward.
const historySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // The app's id for the title, e.g. "video:<id>"; one record per title.
  key: { type: String, required: true, maxlength: 200 },
  // The title as the app plays it (a YouTube video, a live channel or a file
  // in the person's own TorBox). Checked by the controller.
  item: { type: Schema.Types.Mixed, required: true },
  watchedAt: { type: Date, required: true },
});
historySchema.index({ user: 1, key: 1 }, { unique: true });
historySchema.index({ user: 1, watchedAt: -1 });

export const History = model('History', historySchema);

export type HistoryEntry = { item: Record<string, unknown>; watchedAt: string };

export function publicEntry(h: { item: unknown; watchedAt: Date; _id?: Types.ObjectId }): HistoryEntry {
  return { item: h.item as Record<string, unknown>, watchedAt: h.watchedAt.toISOString() };
}
