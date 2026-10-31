import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

// An account reached by a verified phone number, a verified email, or (for
// accounts made before verification existed) an email and password. At least
// one of email and phone is always set.
const userSchema = new Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    // Confirmed with a code through Phone.Email. Only verified emails can be
    // found by friends.
    emailVerified: { type: Boolean, default: false },
    // Only accounts from before verification have one; they can still sign in
    // with it.
    passwordHash: { type: String },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Always verified through Phone.Email: it's only ever set from a confirmed
    // code, so friends who find you by number have the right person.
    // Digits only with the country code, e.g. 919876543210.
    phone: { type: String, unique: true, sparse: true },
    isAdmin: { type: Boolean, default: false },
    isadmin: { type: Boolean, default: false },
    // A small square picture, as a `data:image/…;base64,…` string. Atlas has
    // no file store, so the bytes live with the account; publicUser hands out
    // a short URL instead of the whole picture.
    avatar: { type: String },
    avatarUpdatedAt: { type: Date },
    screenTimeSeconds: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);

/** What other people get to see of a person: their email only once verified. */
export function publicUser(user: {
  _id: Types.ObjectId;
  name: string;
  email?: string | null;
  emailVerified?: boolean | null;
  avatar?: string | null;
  avatarUpdatedAt?: Date | null;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.emailVerified ? (user.email ?? undefined) : undefined,
    avatar: avatarPath(user),
  };
}

/** Where the account's picture is served, with a version for caching. */
function avatarPath(user: { _id: Types.ObjectId; avatar?: string | null; avatarUpdatedAt?: Date | null }) {
  if (!user.avatar) return undefined;
  const version = user.avatarUpdatedAt ? user.avatarUpdatedAt.getTime() : 0;
  return `/avatars/${user._id.toString()}?v=${version}`;
}

/** The signed-in person's own profile. */
export function ownProfile(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email ?? undefined,
    emailVerified: !!user.emailVerified,
    phone: user.phone ?? undefined,
    hasPassword: !!user.passwordHash,
    isAdmin: !!(user.isAdmin || (user as any).isadmin),
    avatar: avatarPath(user),
    screenTimeSeconds: user.screenTimeSeconds ?? 0,
    lastActiveAt: user.lastActiveAt,
  };
}
