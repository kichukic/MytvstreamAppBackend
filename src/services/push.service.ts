// Push notifications. Uses FCM's legacy HTTP API when FCM_SERVER_KEY is set;
// otherwise it's a no-op so the rest of the app keeps working.
import { DeviceToken } from '../models/deviceToken.model.js';

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

export async function pushToUser(userId: string, payload: { title: string; body: string; data?: Record<string, string> }) {
  const key = process.env.FCM_SERVER_KEY;
  if (!key) return;
  const tokens = await DeviceToken.find({ user: userId }).lean();
  if (tokens.length === 0) return;
  const tokenList = tokens.map((t) => t.token);
  try {
    await fetch(FCM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `key=${key}` },
      body: JSON.stringify({
        registration_ids: tokenList,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        priority: 'high',
      }),
    });
  } catch {
    // best effort
  }
}

export async function pushToUsers(userIds: string[], payload: { title: string; body: string; data?: Record<string, string> }) {
  await Promise.all(userIds.map((u) => pushToUser(u, payload)));
}
