import { Schema, model, type Types } from 'mongoose';

// One record per pair of people. `pair` is the two ids sorted and joined, so a
// request one way and a request back can't both exist.
const friendshipSchema = new Schema(
  {
    pair: { type: String, required: true, unique: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted'], required: true, default: 'pending' },
  },
  { timestamps: true },
);
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });

export const Friendship = model('Friendship', friendshipSchema);

export function pairKey(a: Types.ObjectId | string, b: Types.ObjectId | string): string {
  return [a.toString(), b.toString()].sort().join('_');
}
