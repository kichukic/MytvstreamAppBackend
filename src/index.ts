// The ForUs chat server: a JSON API for accounts, friends and messages, and a
// Socket.IO connection that pushes new messages to the app as they're sent.
//
//   routes/       which URL goes to which controller (and its middleware)
//   controllers/  reading and checking the request, shaping the response
//   services/     the business logic and database work
//   models/       the MongoDB collections
import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { routes } from './routes/index.js';
import { startRealtime } from './services/realtime.service.js';

const app = express();
// Behind one proxy at most (a host's load balancer), for the rate limits.
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
// A profile picture is a data URI, much larger than the rest of the API's
// bodies. This has to be registered before the small global parser.
app.use('/me/avatar', express.json({ limit: '3mb' }));
// A whole contact list can be sent for matching; everything else is small.
app.use('/contacts', express.json({ limit: '256kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(routes);
app.use(notFound);
app.use(errorHandler);

const server = createServer(app);
startRealtime(server);
// On every network interface, so the phone can reach it over Wi-Fi. It starts
// listening before the database is up, so the host sees it running and
// /health can say what's wrong while the database is out of reach.
server.listen(config.port, '0.0.0.0', () => {
  console.log(`ForUs backend on http://0.0.0.0:${config.port}`);
});

const RETRY_MS = 15000;

// Keeps trying until the database answers (e.g. while Atlas's network access
// list doesn't include this host yet), instead of the server exiting.
async function connectDatabase() {
  for (;;) {
    try {
      await mongoose.connect(config.mongoUrl, { dbName: config.mongoDb, serverSelectionTimeoutMS: 10000 });
      // Builds the indexes (unique emails and so on).
      await mongoose.syncIndexes();
      console.log('Database connected');
      return;
    } catch (err) {
      console.error(`Database unreachable, retrying in ${RETRY_MS / 1000}s: ${(err as Error).message}`);
      await mongoose.disconnect().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }
}
void connectDatabase();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void mongoose.disconnect().then(() => process.exit(0));
  });
}
