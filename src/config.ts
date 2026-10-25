// Settings from the environment (.env locally, the dashboard on Render). The
// server refuses to start without a proper JWT secret rather than run with a
// guessable one.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // Atlas's MONGODB_URI, or MONGO_URL for the local Docker database.
  mongoUrl: process.env.MONGODB_URI || required('MONGO_URL'),
  // Atlas addresses don't name a database, so it's chosen here.
  mongoDb: process.env.MONGO_DB ?? 'forus',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
};
