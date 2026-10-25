// Accounts: signing in (or up) with a verified phone number or email, the
// older email + password sign-in, and the signed-in person's profile.
import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { User, ownProfile, type UserDoc } from '../models/user.model.js';
import { HttpError } from '../utils/httpError.js';
import { signToken } from '../utils/token.js';
import { readTicket, signTicket, verifyEmailResult, verifyPhoneToken, type Verified } from './verification.service.js';

// Compared against when the email isn't registered, so a wrong email takes as
// long as a wrong password and doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

function session(user: UserDoc) {
  return { token: signToken(user._id.toString()), user: ownProfile(user) };
}

/** Accounts made before verification: email and password. */
export async function login(email: string, password: string) {
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Wrong email or password.');
  return session(user);
}

/**
 * Signs in with what Phone.Email just verified. A known phone or email signs
 * straight in (and an email becomes verified: whoever proves they own it gets
 * its account). Something new gets a ticket to finish making the account.
 */
async function verifiedLogin(verified: Verified, suggestedName?: string) {
  const user = await User.findOne(verified);
  if (user) {
    if ('email' in verified && !user.emailVerified) {
      user.emailVerified = true;
      await user.save();
    }
    return { ...session(user), isNew: false as const };
  }
  return { isNew: true as const, ticket: signTicket(verified), suggestedName };
}

export async function phoneLogin(accessToken: string) {
  const { phone, name } = await verifyPhoneToken(accessToken);
  return verifiedLogin({ phone }, name);
}

export async function emailLogin(resultUrl: string) {
  return verifiedLogin(await verifyEmailResult(resultUrl));
}

/** Makes the account for a ticket from phoneLogin or emailLogin. */
export async function registerWithTicket(ticket: string, name: string) {
  const verified = readTicket(ticket);
  // Made meanwhile (the same number or email on another device): sign in.
  const existing = await User.findOne(verified);
  if (existing) return session(existing);
  const user = await User.create('email' in verified ? { ...verified, emailVerified: true, name } : { ...verified, name });
  return session(user);
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

/** Adds, changes or confirms the signed-in person's email. */
export async function verifyEmail(userId: Types.ObjectId, resultUrl: string) {
  const { email } = await verifyEmailResult(resultUrl);
  const user = await findSelf(userId);
  if (await User.exists({ email, _id: { $ne: user._id } })) {
    throw new HttpError(409, 'This email is already on another ForUs account.');
  }
  // A new address replaces the old one, so a password tied to it goes too.
  if (user.email !== email) user.passwordHash = undefined;
  user.email = email;
  user.emailVerified = true;
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

/** Removes the email, unless it's the only way to sign in to the account. */
export async function removeEmail(userId: Types.ObjectId) {
  const user = await findSelf(userId);
  if (!user.phone) throw new HttpError(400, 'Your email is how you sign in, so it has to stay.');
  user.email = undefined;
  user.emailVerified = false;
  user.passwordHash = undefined;
  await user.save();
  return ownProfile(user);
}
