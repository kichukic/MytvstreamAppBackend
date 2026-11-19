import { Schema, model, type Types } from 'mongoose';

const ratingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // The app's id for the title, e.g. "moviebox:12345".
  key: { type: String, required: true, maxlength: 200 },
  // What kind of title it is.
  kind: { type: String, required: true, maxlength: 40 },
  title: { type: String, required: true, maxlength: 300 },
  poster: { type: String, maxlength: 500 },
  // 1..5 stars.
  stars: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
ratingSchema.index({ user: 1, key: 1 }, { unique: true });
ratingSchema.index({ key: 1, updatedAt: -1 });

export const Rating = model('Rating', ratingSchema);

export type RatingEntry = {
  user: string;
  userName?: string;
  key: string;
  kind: string;
  title: string;
  poster?: string;
  stars: number;
  review?: string;
  createdAt: string;
  updatedAt: string;
};
