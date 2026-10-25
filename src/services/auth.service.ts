// Accounts: creating one, signing in, and the signed-in person's profile.
import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { User, ownProfile } from '../models/user.model.js';
import { HttpError } from '../utils/httpError.js';
import { signToken } from '../utils/token.js';

const HASH_ROUNDS = 12;
// Compared against when the email isn't registered, so a wrong email takes as
// long as a wrong password and doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', HASH_ROUNDS);

async function assertPhoneFree(phone: string, exceptUser?: Types.ObjectId) {
  const taken = await User.exists({ phone, ...(exceptUser ? { _id: { $ne: exceptUser } } : {}) });
  if (taken) throw new HttpError(409, 'This phone number is already on another account.');
}

export async function register(input: { email: string; password: string; name: string; phone?: string }) {
  if (await User.exists({ email: input.email })) throw new HttpError(409, 'An account with this email already exists.');
  if (input.phone) await assertPhoneFree(input.phone);
  const user = await User.create({
    email: input.email,
    name: input.name,
    phone: input.phone,
    passwordHash: await bcrypt.hash(input.password, HASH_ROUNDS),
  });
  return { token: signToken(user._id.toString()), user: ownProfile(user) };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Wrong email or password.');
  return { token: signToken(user._id.toString()), user: ownProfile(user) };
}

async function findSelf(userId: Types.ObjectId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, 'Sign in again.');
  return user;
}

export async function getProfile(userId: Types.ObjectId) {
  return ownProfile(await findSelf(userId));
}

/** `phone: ''` removes the number. */
export async function updateProfile(userId: Types.ObjectId, patch: { name?: string; phone?: string }) {
  const user = await findSelf(userId);
  if (patch.name) user.name = patch.name;
  if (patch.phone !== undefined) {
    if (patch.phone) await assertPhoneFree(patch.phone, user._id);
    user.phone = patch.phone || undefined;
  }
  await user.save();
  return ownProfile(user);
}
