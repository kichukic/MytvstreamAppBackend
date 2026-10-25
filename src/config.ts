// Settings from the environment (.env in development). The server refuses to
// start without a proper JWT secret rather than run with a guessable one.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUrl: required('MONGO_URL'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
};
