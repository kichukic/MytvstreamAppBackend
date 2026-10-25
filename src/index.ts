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
app.use(express.json({ limit: '32kb' }));
app.use(routes);
app.use(notFound);
app.use(errorHandler);

await mongoose.connect(config.mongoUrl, { dbName: config.mongoDb });
// Builds the indexes (unique emails and so on) before taking requests.
await mongoose.syncIndexes();

const server = createServer(app);
startRealtime(server);
// On every network interface, so the phone can reach it over Wi-Fi.
server.listen(config.port, '0.0.0.0', () => {
  console.log(`ForUs backend on http://0.0.0.0:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void mongoose.disconnect().then(() => process.exit(0));
  });
}
