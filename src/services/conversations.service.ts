// Conversations between two friends: the list of them, a conversation's
// messages a page at a time, sending, and marking as read.
import type { Types } from 'mongoose';
import { pairKey } from '../models/friendship.model.js';
import { Message, publicMessage, type MessageDoc } from '../models/message.model.js';
import { User, publicUser } from '../models/user.model.js';
import { assertFriends } from './friends.service.js';
import { emitTo } from './realtime.service.js';

const PAGE_SIZE = 40;
const MAX_CONVERSATIONS = 200;

export type SharedTitle =
  | { kind: 'video'; videoId: string; title: string }
  | { kind: 'web'; url: string; title: string; poster?: string }
  | { kind: 'stream'; url: string; title: string; poster?: string }
  | { kind: 'movie'; id: string; title: string; poster?: string; year?: string }
  | { kind: 'moviebox'; subjectId: string; season?: number; episode?: number; title: string; poster?: string }
  | { kind: 'file'; source: string; itemId: number; fileId: number; title: string };

/** Every conversation, newest first, with its last message and unread count. */
export async function listConversations(self: Types.ObjectId) {
  const rows = await Message.aggregate<{ _id: string; last: MessageDoc; unread: number }>([
    { $match: { $or: [{ sender: self }, { recipient: self }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversation',
        last: { $first: '$$ROOT' },
        unread: {
          $sum: { $cond: [{ $and: [{ $eq: ['$recipient', self] }, { $not: ['$readAt'] }] }, 1, 0] },
        },
      },
    },
    { $sort: { 'last.createdAt': -1 } },
    { $limit: MAX_CONVERSATIONS },
  ]);

  const otherIds = rows.map((r) => (r.last.sender.equals(self) ? r.last.recipient : r.last.sender));
  const people = new Map(
    (await User.find({ _id: { $in: otherIds } }, 'name email emailVerified').lean()).map((u) => [u._id.toString(), u]),
  );
  return rows.flatMap((r, i) => {
    const other = people.get(otherIds[i].toString());
    // The other account was deleted.
    if (!other) return [];
    return [{ user: publicUser(other), last: publicMessage(r.last), unread: r.unread }];
  });
}

/** A page of messages with one person, newest first; `before` for older pages. */
export async function listMessages(self: Types.ObjectId, other: Types.ObjectId, before?: Date) {
  const messages = await Message.find({
    conversation: pairKey(self, other),
    ...(before ? { createdAt: { $lt: before } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE)
    .lean<MessageDoc[]>();
  return { messages: messages.map(publicMessage), more: messages.length === PAGE_SIZE };
}

export async function sendMessage(
  self: Types.ObjectId,
  other: Types.ObjectId,
  content: { text?: string; title?: SharedTitle },
) {
  await assertFriends(self, other);
  const message = await Message.create({
    conversation: pairKey(self, other),
    sender: self,
    recipient: other,
    text: content.text || undefined,
    title: content.title,
  });
  const out = publicMessage(message.toObject() as MessageDoc);
  const sender = await User.findById(self, 'name email emailVerified').lean();
  // To the friend, and to the sender's other devices.
  const live = { message: out, from: sender ? publicUser(sender) : undefined };
  emitTo(other, 'message', live);
  emitTo(self, 'message', live);
  return out;
}

/** Marks everything the other person sent as read, and tells both sides. */
export async function markRead(self: Types.ObjectId, other: Types.ObjectId) {
  const at = new Date();
  const result = await Message.updateMany(
    { conversation: pairKey(self, other), recipient: self, readAt: { $exists: false } },
    { $set: { readAt: at } },
  );
  if (result.modifiedCount > 0) {
    emitTo(other, 'read', { userId: self.toString(), at: at.toISOString() });
    emitTo(self, 'read', { userId: self.toString(), with: other.toString(), at: at.toISOString() });
  }
}
