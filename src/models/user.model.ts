import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

// An account made with email + password, or with a verified phone number, or
// both. At least one of email and phone is always set.
const userSchema = new Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    // Only for accounts that sign in with email.
    passwordHash: { type: String },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Always verified through Phone.Email: it's only ever set from a confirmed
    // sign-in, so friends who find you by number have the right person.
    // Digits only with the country code, e.g. 919876543210.
    phone: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);

/** What other people get to see of a person. */
export function publicUser(user: Pick<UserDoc, '_id' | 'name' | 'email'>) {
  return { id: user._id.toString(), name: user.name, email: user.email ?? undefined };
}

/** The signed-in person's own profile, which includes their phone. */
export function ownProfile(user: UserDoc) {
  return { ...publicUser(user), phone: user.phone ?? undefined, hasPassword: !!user.passwordHash };
}
