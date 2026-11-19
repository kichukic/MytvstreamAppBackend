import { Schema, model, type Types } from 'mongoose';

const deviceTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // FCM/APNs token.
  token: { type: String, required: true, maxlength: 500 },
  platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
deviceTokenSchema.index({ user: 1, token: 1 }, { unique: true });

export const DeviceToken = model('DeviceToken', deviceTokenSchema);
