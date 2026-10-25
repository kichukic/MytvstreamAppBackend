import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Optional, so friends can find you by number. Stored digits-only with the
    // country code, e.g. 919876543210.
    phone: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);

/** What other people get to see of a person. */
export function publicUser(user: Pick<UserDoc, '_id' | 'name' | 'email'>) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

/** The signed-in person's own profile, which includes their phone. */
export function ownProfile(user: UserDoc) {
  return { ...publicUser(user), phone: user.phone ?? undefined };
}
