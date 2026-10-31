# ForUs backend

The chat server for the ForUs app: accounts (email + password), friends found
by exact email or phone number, one-to-one messages, and films shared as cards.
Node.js + Express + MongoDB, with Socket.IO pushing new messages to the app as
they're sent.

## Run it

```bash
npm install
cp .env.example .env        # then set JWT_SECRET: openssl rand -hex 32
npm run db:up               # MongoDB in Docker, on 127.0.0.1:27018
npm run dev                 # the server, restarting on changes

GEMINI_API_KEY (aistudio.google.com/apikey) turns on the AI search and the
Tonight concierge. Without it those routes answer 503 and everything else runs
as usual.
```

The server listens on every interface at port 4000, so a phone on the same
Wi-Fi reaches it at `http://<this computer's IP>:4000` (the app's default is
`http://192.168.1.86:4000`; change it under "Server" on the app's sign-in
screen). `GET /health` answers `{"ok":true,"db":true}` when all is well.

Production: `npm run build && npm start`.

## Layout

```
src/
  index.ts        app setup: middleware, routes, database, socket
  config.ts       settings from .env
  routes/         which URL goes to which controller, and its middleware
  controllers/    reads and checks the request, calls a service, sends the response
  services/       business logic and database work (no req/res here)
  models/         MongoDB collections: user, friendship, message
  middleware/     sign-in check, rate limits, error handling
  utils/          tokens, input validation, HttpError
```

A service throws `HttpError(status, message)` for anything the person should
see; the error middleware turns it into `{ "error": message }`.

## API

All bodies are JSON. Everything except the `/auth/…` routes and
`/avatars/:userId` needs `Authorization: Bearer <token>`.

| Method | Path | What |
| --- | --- | --- |
| POST | `/auth/register` | `{email, password, name}` → `{token, user}` |
| POST | `/auth/login` | `{email, password}` → `{token, user}` |
| POST | `/auth/phone` | `{accessToken}` from Phone.Email → `{isNew: false, token, user}` for a known number, or `{isNew: true, ticket, suggestedName?}` |
| POST | `/auth/phone/register` | `{ticket, name}` → `{token, user}` (a phone-only account) |
| GET / PATCH | `/me` | Your profile; PATCH `{name}` |
| PATCH | `/me/avatar` | `{avatar: "data:image/jpeg;base64,…"}` (a square picture, at most 1.5 MB), or `{avatar: null}` to remove it |
| GET | `/avatars/:userId` | Public: the picture bytes behind the short path in profiles |
| POST / DELETE | `/me/phone` | Add or change your number with `{accessToken}`; DELETE removes it (not on phone-only accounts) |
| GET | `/users/lookup?email=…` or `?phone=…` | One person by exact match, and how you relate to them |
| GET | `/friends` | `{friends, incoming, outgoing}` |
| POST | `/friends/requests` | `{userId}`; asking someone who asked you accepts |
| POST | `/friends/requests/:id/accept` | Accept a request sent to you |
| DELETE | `/friends/requests/:id` | Decline one sent to you, or cancel one you sent |
| DELETE | `/friends/:userId` | Unfriend (history stays, sending stops) |
| GET | `/conversations` | Newest first, with last message and unread count |
| GET | `/conversations/:userId/messages?before=<ISO date>` | 40 at a time, newest first |
| POST | `/conversations/:userId/messages` | `{text}` or `{title: {kind: 'video', videoId, title}}` |
| POST | `/conversations/:userId/read` | Mark the friend's messages read |
| GET | `/history` | The signed-in person's watched titles |
| POST | `/history` | Merge the app's watched titles into the account's |
| DELETE | `/history` | Clear them |
| POST | `/ai/search` | `{prompt}` → `{results: [{title, year, reason}]}` from Gemini |
| POST | `/ai/tonight` | `{mood?, minutes?, company?, language?, recentTitles?}` → `{pick: {title, year, kind, reason}}` |

Socket.IO connects with `auth: {token}` and receives `message`, `read`,
`friend-request`, `friend-accepted`, `friend-removed`, `presence` and
`watching`. Presence and watching are friends-only and kept in memory:

| Direction | Event | What |
| --- | --- | --- |
| → | `presence:list` | Ask for the ids of friends online now |
| → | `watching:list` | Ask what friends are playing |
| → | `watching:update` | `{kind, …}` announce this device's playback |
| → | `watching:stop` | Stop showing it |
| ← | `presence` / `presence:list` | A friend came online or went away |
| ← | `watching` / `watching:stop` | A friend started, changed or stopped a title |
| ← | `watching:list` | `{items: [{user, watching, at}], at}`: `at` is when the list was made |

## Notes

- Phone numbers are only ever stored after Phone.Email confirms them: the app
  sends the access token from their sign-in page, and the server asks
  `https://eapi.phone.email/getuser` (with `PHONE_EMAIL_CLIENT_ID`) for the
  number it verified. So finding a friend by number always finds the real owner.
- Passwords are hashed with bcrypt; sign-in and lookups are rate-limited per IP.
- Only friends can message each other.
- Before putting this on the internet, run it behind HTTPS (and then build the
  app with `EXPO_PUBLIC_CHAT_SERVER=https://…`).
