// Finding people and managing friends. Someone is found by their exact email
// or phone number only, never by browsing or partial matches, so the list of
// people on ForUs can't be read out. Messaging needs an accepted friendship.
import type { Types } from 'mongoose';
import { Friendship, pairKey } from '../models/friendship.model.js';
import { User, publicUser } from '../models/user.model.js';
import { HttpError } from '../utils/httpError.js';
import { emitTo } from './realtime.service.js';

export type Relation = 'none' | 'friends' | 'requested' | 'incoming';
type Link = { requester: Types.ObjectId; status: string } | null;
type Person = { _id: Types.ObjectId; name: string; email?: string | null; emailVerified?: boolean | null };

/** How `self` relates to the other side of a friendship record. */
function relation(link: Link, self: Types.ObjectId): Relation {
  if (!link) return 'none';
  if (link.status === 'accepted') return 'friends';
  return link.requester.equals(self) ? 'requested' : 'incoming';
}

export async function lookUp(self: Types.ObjectId, query: { email: string } | { phone: string }) {
  // Only a verified email finds someone (a phone number always is).
  const user = await User.findOne('email' in query ? { ...query, emailVerified: true } : query);
  if (!user) throw new HttpError(404, 'No one on ForUs has that email or number.');
  if (user._id.equals(self)) throw new HttpError(400, "That's you.");
  const link = await Friendship.findOne({ pair: pairKey(self, user._id) });
  return { user: publicUser(user), status: relation(link, self) };
}

/** Friends, plus requests waiting either way, most recent first. */
export async function listFriends(self: Types.ObjectId) {
  const links = await Friendship.find({ $or: [{ requester: self }, { recipient: self }] })
    .populate<{ requester: Person }>('requester', 'name email emailVerified')
    .populate<{ recipient: Person }>('recipient', 'name email emailVerified')
    .sort({ updatedAt: -1 })
    .lean();

  const out = {
    friends: [] as { requestId: string; user: ReturnType<typeof publicUser> }[],
    incoming: [] as { requestId: string; user: ReturnType<typeof publicUser> }[],
    outgoing: [] as { requestId: string; user: ReturnType<typeof publicUser> }[],
  };
  for (const link of links) {
    // A deleted account leaves its links pointing at nothing.
    if (!link.requester || !link.recipient) continue;
    const mine = link.requester._id.equals(self);
    const entry = { requestId: link._id.toString(), user: publicUser(mine ? link.recipient : link.requester) };
    if (link.status === 'accepted') out.friends.push(entry);
    else if (mine) out.outgoing.push(entry);
    else out.incoming.push(entry);
  }
  return out;
}

async function notify(to: Types.ObjectId, event: 'friend-request' | 'friend-accepted', from: Types.ObjectId, extra = {}) {
  const user = await User.findById(from, 'name email emailVerified').lean();
  if (user) emitTo(to, event, { ...extra, user: publicUser(user) });
}

/** Asks someone to be friends; asking someone who already asked you accepts. */
export async function sendRequest(self: Types.ObjectId, other: Types.ObjectId): Promise<{ status: Relation; requestId?: string }> {
  if (other.equals(self)) throw new HttpError(400, "You can't add yourself.");
  if (!(await User.exists({ _id: other }))) throw new HttpError(404, 'That person is no longer on ForUs.');

  const pair = pairKey(self, other);
  const existing = await Friendship.findOne({ pair });
  if (existing?.status === 'accepted') throw new HttpError(409, "You're already friends.");
  if (existing?.requester.equals(self)) throw new HttpError(409, 'Request already sent.');

  if (existing) {
    existing.status = 'accepted';
    await existing.save();
    await notify(other, 'friend-accepted', self);
    return { status: 'friends' };
  }

  const link = await Friendship.create({ pair, requester: self, recipient: other });
  await notify(other, 'friend-request', self, { requestId: link._id.toString() });
  return { status: 'requested', requestId: link._id.toString() };
}

export async function acceptRequest(self: Types.ObjectId, requestId: Types.ObjectId) {
  const link = await Friendship.findById(requestId);
  if (!link || !link.recipient.equals(self) || link.status !== 'pending') {
    throw new HttpError(404, 'That request is no longer there.');
  }
  link.status = 'accepted';
  await link.save();
  await notify(link.requester, 'friend-accepted', self);
}

/** Declines a request someone sent, or cancels one you sent. */
export async function dropRequest(self: Types.ObjectId, requestId: Types.ObjectId) {
  const link = await Friendship.findById(requestId);
  if (!link || link.status !== 'pending' || !(link.requester.equals(self) || link.recipient.equals(self))) {
    throw new HttpError(404, 'That request is no longer there.');
  }
  await link.deleteOne();
}

/** Unfriending. The messages stay, but neither side can send more. */
export async function unfriend(self: Types.ObjectId, other: Types.ObjectId) {
  const removed = await Friendship.findOneAndDelete({ pair: pairKey(self, other), status: 'accepted' });
  if (!removed) throw new HttpError(404, "You're not friends.");
  emitTo(other, 'friend-removed', { userId: self.toString() });
}

export async function assertFriends(self: Types.ObjectId, other: Types.ObjectId) {
  if (!(await Friendship.exists({ pair: pairKey(self, other), status: 'accepted' }))) {
    throw new HttpError(403, 'You can only message friends.');
  }
}
