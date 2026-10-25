// The live connection each signed-in app keeps open. Every user's sockets join
// a room named after their id, so anything for them reaches all their devices
// at once. Services call `emitTo` after saving a change.
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';

let io: Server | null = null;

// Track active online users: userId -> { count: number, connectedAt: number }
const activeUsers = new Map<string, { count: number; connectedAt: number }>();

export type LiveEvent =
  | 'message' // a new message, for the sender's other devices too
  | 'read' // the other person read the conversation up to now
  | 'friend-request'
  | 'friend-accepted'
  | 'friend-removed';

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

    // Track online presence
    const current = activeUsers.get(userId) ?? { count: 0, connectedAt: Date.now() };
    current.count++;
    activeUsers.set(userId, current);

    // Update lastActiveAt in database
    void User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).exec().catch(() => {});

    // Periodic heartbeat from active client (e.g. every 30-60s)
    socket.on('screen-time-heartbeat', (data?: { seconds?: number }) => {
      const sec = typeof data?.seconds === 'number' && data.seconds > 0 && data.seconds <= 300 ? data.seconds : 30;
      void User.findByIdAndUpdate(userId, {
        $inc: { screenTimeSeconds: sec },
        $set: { lastActiveAt: new Date() },
      }).exec().catch(() => {});
    });

    socket.on('disconnect', () => {
      const existing = activeUsers.get(userId);
      if (!existing) return;
      existing.count--;
      if (existing.count <= 0) {
        const sessionSeconds = Math.max(0, Math.floor((Date.now() - existing.connectedAt) / 1000));
        activeUsers.delete(userId);
        void User.findByIdAndUpdate(userId, {
          $inc: { screenTimeSeconds: sessionSeconds },
          $set: { lastActiveAt: new Date() },
        }).exec().catch(() => {});
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
