// The live connection each signed-in app keeps open. Every user's sockets join
// a room named after their id, so anything for them reaches all their devices
// at once. Services call `emitTo` after saving a change.
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/token.js';

let io: Server | null = null;

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
    socket.join(socket.data.userId as string);
  });
}

export function emitTo(userId: { toString(): string }, event: LiveEvent, payload: unknown) {
  io?.to(userId.toString()).emit(event, payload);
}
