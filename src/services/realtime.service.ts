// The live connection each signed-in app keeps open. Every user's sockets join
// a room named after their id, so anything for them reaches all their devices
// at once. Services call `emitTo` after saving a change.
//
// The connection is also how friends see each other: who is around, and what
// they are watching. Both are friends-only and held in memory; none of it is
// written to the database.
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { Friendship } from '../models/friendship.model.js';
import { User, publicUser } from '../models/user.model.js';
import { verifyToken } from '../utils/token.js';

let io: Server | null = null;

// Track active online users: userId -> { count: number, connectedAt: number }
const activeUsers = new Map<string, { count: number; connectedAt: number }>();

// What each person is watching right now. The socket id is kept so a second
// device (or an old connection) can't clear a newer one's playback.
const watchingByUser = new Map<string, { socketId: string; watching: WatchingTitle; at: number }>();
// If a phone goes away without disconnecting cleanly, the entry eventually
// stops being shown to friends.
const WATCHING_TTL_MS = 4 * 60 * 60 * 1000;

export type LiveEvent =
  | 'message' // a new message, for the sender's other devices too
  | 'read' // the other person read the conversation up to now
  | 'friend-request'
  | 'friend-accepted'
  | 'friend-removed'
  | 'presence' // a friend came online or went away
  | 'watching' // a friend started or changed what they are watching
  | 'watching:stop'; // a friend stopped watching

// The same title shape the app uses, with bounded strings: a socket message
// never gets to fill memory with an arbitrarily large payload.
const title = z.string().trim().min(1).max(200);
const poster = z.string().trim().max(2048).optional();
const url = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), 'Only web links are allowed.');

const watchingTitleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('video'), videoId: z.string().trim().min(1).max(100), title }),
  z.object({ kind: z.literal('live'), channelId: z.string().trim().min(1).max(100), title }),
  z.object({
    kind: z.literal('file'),
    source: z.enum(['torrents', 'usenet', 'webdl']),
    itemId: z.number().int().nonnegative(),
    fileId: z.number().int().nonnegative(),
    title,
  }),
  z.object({ kind: z.literal('stream'), url, title, poster }),
  z.object({ kind: z.literal('web'), url, title, poster }),
  z.object({
    kind: z.literal('moviebox'),
    subjectId: z.string().trim().min(1).max(100),
    season: z.number().int().nonnegative().optional(),
    episode: z.number().int().nonnegative().optional(),
    title,
    poster,
  }),
]);

export type WatchingTitle = z.infer<typeof watchingTitleSchema>;

export function startRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: '*' } });

  io.use((socket, next) => {
    const userId = verifyToken(socket.handshake.auth?.token as string | undefined);
    if (!userId) return next(new Error('unauthorized'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(userId);

    // Track online presence. Only the first socket (and the last one to go)
    // changes what friends see.
    const current = activeUsers.get(userId) ?? { count: 0, connectedAt: Date.now() };
    current.count++;
    activeUsers.set(userId, current);
    if (current.count === 1) void notifyFriends(userId, 'presence', { userId, online: true, at: new Date().toISOString() });

    // Update lastActiveAt in database
    void User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).exec().catch(() => {});

    // The client asks for these on every (re)connect, and after a friendship
    // changes, so a missed event is corrected.
    socket.on('presence:list', () => void sendPresenceList(socket, userId));
    socket.on('watching:list', () => void sendWatchingList(socket, userId));

    socket.on('watching:update', (data: unknown) => {
      const parsed = watchingTitleSchema.safeParse(data);
      if (!parsed.success) return;
      const at = Date.now();
      watchingByUser.set(userId, { socketId: socket.id, watching: parsed.data, at });
      void notifyFriends(userId, 'watching', {
        user: null, // filled in once, below, so friends get a name with the title
        watching: parsed.data,
        at: new Date(at).toISOString(),
      });
    });

    socket.on('watching:stop', () => {
      const currentWatch = watchingByUser.get(userId);
      if (currentWatch?.socketId !== socket.id) return;
      watchingByUser.delete(userId);
      void notifyFriends(userId, 'watching:stop', { userId, at: new Date().toISOString() });
    });

    // Periodic heartbeat from active client (e.g. every 30-60s)
    socket.on('screen-time-heartbeat', (data?: { seconds?: number }) => {
      const sec = typeof data?.seconds === 'number' && data.seconds > 0 && data.seconds <= 300 ? data.seconds : 30;
      void User.findByIdAndUpdate(userId, {
        $inc: { screenTimeSeconds: sec },
        $set: { lastActiveAt: new Date() },
      }).exec().catch(() => {});
    });

    // Watch party: create/join a room and broadcast playback state.
    socket.on('party:create', (data: unknown) => {
      const code = typeof data === 'object' && data && 'code' in data ? String((data as { code: unknown }).code).trim().slice(0, 12) : '';
      if (!code) return;
      socket.join(`party:${code}`);
      socket.data.party = code;
      socket.emit('party:joined', { code, host: userId });
      io?.to(`party:${code}`).emit('party:member', { userId, joined: true });
    });
    socket.on('party:join', (data: unknown) => {
      const code = typeof data === 'object' && data && 'code' in data ? String((data as { code: unknown }).code).trim().slice(0, 12) : '';
      if (!code) return;
      socket.join(`party:${code}`);
      socket.data.party = code;
      socket.emit('party:joined', { code });
      io?.to(`party:${code}`).emit('party:member', { userId, joined: true });
    });
    socket.on('party:leave', () => {
      const code = socket.data.party as string | undefined;
      if (!code) return;
      socket.leave(`party:${code}`);
      socket.data.party = undefined;
      io?.to(`party:${code}`).emit('party:member', { userId, joined: false });
    });
    socket.on('party:play', (data: unknown) => {
      const code = socket.data.party as string | undefined;
      if (!code) return;
      io?.to(`party:${code}`).emit('party:play', { userId, ...(data && typeof data === 'object' ? data : {}) });
    });
    socket.on('party:pause', (data: unknown) => {
      const code = socket.data.party as string | undefined;
      if (!code) return;
      io?.to(`party:${code}`).emit('party:pause', { userId, ...(data && typeof data === 'object' ? data : {}) });
    });
    socket.on('party:seek', (data: unknown) => {
      const code = socket.data.party as string | undefined;
      if (!code) return;
      io?.to(`party:${code}`).emit('party:seek', { userId, ...(data && typeof data === 'object' ? data : {}) });
    });
    socket.on('party:chat', (data: unknown) => {
      const code = socket.data.party as string | undefined;
      if (!code) return;
      const text = typeof data === 'object' && data && 'text' in data ? String((data as { text: unknown }).text).slice(0, 500) : '';
      if (!text) return;
      io?.to(`party:${code}`).emit('party:chat', { userId, text, at: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      const existing = activeUsers.get(userId);
      if (existing) {
        existing.count--;
        if (existing.count <= 0) {
          const sessionSeconds = Math.max(0, Math.floor((Date.now() - existing.connectedAt) / 1000));
          activeUsers.delete(userId);
          void User.findByIdAndUpdate(userId, {
            $inc: { screenTimeSeconds: sessionSeconds },
            $set: { lastActiveAt: new Date() },
          }).exec().catch(() => {});
          void notifyFriends(userId, 'presence', { userId, online: false, at: new Date().toISOString() });
        }
      }

      const currentWatch = watchingByUser.get(userId);
      if (currentWatch?.socketId === socket.id) {
        watchingByUser.delete(userId);
        void notifyFriends(userId, 'watching:stop', { userId, at: new Date().toISOString() });
      }
    });
  });
}

export function emitTo(userId: { toString(): string }, event: LiveEvent, payload: unknown) {
  io?.to(userId.toString()).emit(event, payload);
}

export function getOnlineUsersMap(): Map<string, { connectedAt: number }> {
  const map = new Map<string, { connectedAt: number }>();
  for (const [id, data] of activeUsers.entries()) {
    map.set(id, { connectedAt: data.connectedAt });
  }
  return map;
}

// ---- Seeing friends ----

/** The ids of everyone this person is accepted friends with. */
async function friendIdsOf(userId: string): Promise<string[]> {
  const links = await Friendship.find(
    { status: 'accepted', $or: [{ requester: userId }, { recipient: userId }] },
    'requester recipient',
  ).lean();
  return links
    .map((link) => (link.requester.toString() === userId ? link.recipient.toString() : link.requester.toString()))
    .filter((id) => id !== userId);
}

/** Sends an event to every one of someone's friends. */
async function notifyFriends(userId: string, event: LiveEvent, payload: Record<string, unknown>) {
  try {
    // `watching` includes the person, so it is looked up once rather than for
    // every friend.
    if (event === 'watching') {
      const user = await User.findById(userId, 'name email emailVerified avatar avatarUpdatedAt').lean();
      if (!user) return;
      payload.user = publicUser(user);
    }
    for (const friendId of await friendIdsOf(userId)) emitTo(friendId, event, payload);
  } catch {
    // Presence and watching are best effort; the database may be unreachable
    // while messages still need the connection.
  }
}

async function sendPresenceList(socket: Socket, userId: string) {
  try {
    const online = (await friendIdsOf(userId)).filter((id) => activeUsers.has(id));
    socket.emit('presence:list', { online });
  } catch {
    // The next reconnect asks again.
  }
}

async function sendWatchingList(socket: Socket, userId: string) {
  try {
    const friendIds = await friendIdsOf(userId);
    const friendSet = new Set(friendIds);
    const now = Date.now();
    const entries: { userId: string; watching: WatchingTitle; at: number }[] = [];
    for (const [id, entry] of watchingByUser) {
      if (now - entry.at > WATCHING_TTL_MS) {
        watchingByUser.delete(id);
        continue;
      }
      if (friendSet.has(id)) entries.push({ userId: id, watching: entry.watching, at: entry.at });
    }
    if (entries.length === 0) {
      socket.emit('watching:list', { items: [], at: new Date(now).toISOString() });
      return;
    }
    const people = new Map(
      (await User.find({ _id: { $in: entries.map((entry) => entry.userId) } }, 'name email emailVerified avatar avatarUpdatedAt').lean()).map(
        (user) => [user._id.toString(), user],
      ),
    );
    const items = entries
      .sort((a, b) => b.at - a.at)
      .flatMap((entry) => {
        const user = people.get(entry.userId);
        return user ? [{ user: publicUser(user), watching: entry.watching, at: new Date(entry.at).toISOString() }] : [];
      });
    socket.emit('watching:list', { items, at: new Date(now).toISOString() });
  } catch {
    // The next reconnect asks again.
  }
}
