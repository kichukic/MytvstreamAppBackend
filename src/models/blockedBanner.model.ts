import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const blockedBannerSchema = new Schema(
  {
    videoId: { type: String, required: true, unique: true, trim: true },
    title: { type: String, trim: true },
    channel: { type: String, trim: true },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    blockedByName: { type: String, trim: true },
  },
  { timestamps: true },
);

export type BlockedBannerDoc = InferSchemaType<typeof blockedBannerSchema> & { _id: Types.ObjectId };
export const BlockedBanner = model('BlockedBanner', blockedBannerSchema);
