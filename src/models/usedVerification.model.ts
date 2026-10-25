import { Schema, model } from 'mongoose';

// Phone.Email results already used. Each verification counts once, so a token
// or link that leaks later can't be replayed to take over an account. Kept a
// month, far longer than Phone.Email keeps them valid.
const usedVerificationSchema = new Schema({
  // A hash of the token or link, not the thing itself.
  key: { type: String, required: true, unique: true },
  usedAt: { type: Date, required: true, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

export const UsedVerification = model('UsedVerification', usedVerificationSchema);
