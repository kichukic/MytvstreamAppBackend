import { Schema, model } from 'mongoose';

// A voice message's recording, held only until the recipient's phone has
// downloaded it; then it's deleted, and each phone keeps its own copy. One
// that's never collected is dropped after 30 days.
const voiceClipSchema = new Schema({
  message: { type: Schema.Types.ObjectId, ref: 'Message', required: true, unique: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mime: { type: String, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

export const VoiceClip = model('VoiceClip', voiceClipSchema);
