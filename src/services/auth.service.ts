// Accounts: creating one, signing in with email or a verified phone number,
// and the signed-in person's profile.
import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { User, ownProfile } from '../models/user.model.js';
import { HttpError } from '../utils/httpError.js';
import { signToken } from '../utils/token.js';
import { readPhoneTicket, signPhoneTicket, verifyPhoneToken } from './phoneVerify.service.js';

const HASH_ROUNDS = 12;
// Compared against when the email isn't registered, so a wrong email takes as
// long as a wrong password and doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', HASH_ROUNDS);

function session(user: Parameters<typeof ownProfile>[0]) {
  return { token: signToken(user._id.toString()), user: ownProfile(user) };
}

export async function register(input: { email: string; password: string; name: string }) {
  if (await User.exists({ email: input.email })) throw new HttpError(409, 'An account with this email already exists.');
  const user = await User.create({
    email: input.email,
    name: input.name,
    passwordHash: await bcrypt.hash(input.password, HASH_ROUNDS),
  });
  return session(user);
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Wrong email or password.');
  return session(user);
}

/**
 * Signing in with a phone number Phone.Email just verified. A known number
 * signs straight in; a new one gets a ticket to finish making the account
 * (with the name Phone.Email has for them, if any, as a suggestion).
 */
export async function phoneLogin(accessToken: string) {
  const verified = await verifyPhoneToken(accessToken);
  const user = await User.findOne({ phone: verified.phone });
  if (user) return { ...session(user), isNew: false as const };
  return { isNew: true as const, ticket: signPhoneTicket(verified.phone), suggestedName: verified.name };
}

export async function phoneRegister(ticket: string, name: string) {
  const phone = readPhoneTicket(ticket);
  // Made meanwhile (the same number on another device): just sign in.
  const existing = await User.findOne({ phone });
  if (existing) return session(existing);
  return session(await User.create({ phone, name }));
}

async function findSelf(userId: Types.ObjectId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, 'Sign in again.');
  return user;
}

export async function getProfile(userId: Types.ObjectId) {
  return ownProfile(await findSelf(userId));
}

export async function updateName(userId: Types.ObjectId, name: string) {
  const user = await findSelf(userId);
  user.name = name;
  await user.save();
  return ownProfile(user);
}

/** Adds (or changes) the signed-in person's number, once Phone.Email confirms it. */
export async function verifyPhone(userId: Types.ObjectId, accessToken: string) {
  const { phone } = await verifyPhoneToken(accessToken);
  const user = await findSelf(userId);
  if (await User.exists({ phone, _id: { $ne: user._id } })) {
    throw new HttpError(409, 'This number is already on another ForUs account.');
  }
  user.phone = phone;
  await user.save();
  return ownProfile(user);
}

/** Removes the number, unless it's the only way to sign in to the account. */
export async function removePhone(userId: Types.ObjectId) {
  const user = await findSelf(userId);
  if (!user.email) throw new HttpError(400, 'Your phone number is how you sign in, so it has to stay.');
  user.phone = undefined;
  await user.save();
  return ownProfile(user);
}
