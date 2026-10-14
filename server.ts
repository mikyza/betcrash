import { createServer } from 'http';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import next from 'next';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env, isProd } from './server/env';
import { logger } from './server/logger';
import { connectDb } from './server/db';
import { GameEngine } from './server/engine';
import { registerSockets } from './server/sockets';
import { buildApi } from './server/routes';
import { depositCallback, reconcileDeposits, withdrawCallback } from './server/routes/payments';
import { hooks } from './server/wallet';
import { acquireEngineLease, releaseEngineLease } from './server/lease';
import { toMajor } from './server/money';
import './server/chain'; // builds the fairness chain at boot (fails fast on bad config)

async function main() {
  const app = express();
  const server = createServer(app);

  // Open the port FIRST. Hosts like Render only stop the old instance once the new one answers on its port, and the old
  // instance holds the engine lease - so waiting for the lease before listening can deadlock a deploy.
  // Until startup finishes, /healthz answers 200 and everything else gets 503.
  let ready = false;
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => res.json({ ok: true, ready }));
  app.use((_req, res, next) => {
    if (ready) return next();
    res.status(503).set('Retry-After', '5').send('Starting up');
  });
  await new Promise<void>((resolve) => server.listen(env.PORT, env.HOST, resolve));
  logger.info(`listening on ${env.HOST}:${env.PORT}, finishing startup`);

  await connectDb();

  const nextApp = next({ dev: !isProd, hostname: env.HOST, port: env.PORT });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  app.set('trust proxy', 1); // behind nginx / Cloudflare / a load balancer
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })); // CSP: set in next.config after testing Unity + Razorpay
  app.use(compression());
  app.use((req, res, next) => { // one log line per API request; callback secrets never reach the logs
    if (!req.path.startsWith('/api/')) return next();
    const t0 = Date.now();
    res.on('finish', () => logger.info({ m: req.method, p: req.path.replace(/(callback)\/[^/]+/, '$1/***'), s: res.statusCode, ms: Date.now() - t0 }, 'http'));
    next();
  });
  if (isProd && !env.PUBLIC_ORIGIN.startsWith('https://')) logger.warn('PUBLIC_ORIGIN is not https - PayHero callbacks and secure cookies need a public https URL in production');

  const io = new SocketIOServer(server, { cors: { origin: env.PUBLIC_ORIGIN, methods: ['GET', 'POST'], credentials: true }, maxHttpBufferSize: 1e5, pingInterval: 20000, pingTimeout: 20000 });

  let redis: Redis | undefined;
  if (env.REDIS_URL) { // optional: only useful when several web instances share Socket.IO rooms
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
    const sub = redis.duplicate();
    redis.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));
    sub.on('error', (err) => logger.warn({ err: err.message }, 'redis sub error'));
    io.adapter(createAdapter(redis, sub));
  }

  const engine = new GameEngine(io);
  hooks.onBalance = (userId, minor) => io.to(`user:${userId}`).emit('balanceUpdate', { balance: toMajor(minor) });

  // Exactly ONE process may run rounds - two engines would double-settle bets. Lease lives in MongoDB.
  // The port is already open, so the platform sees this instance as alive while it waits for the old one to let go.
  await acquireEngineLease();

  app.use(express.json({ limit: '100kb' }));
  app.post('/api/v1/payments/payhero/deposit-callback/:secret', depositCallback);
  app.post('/api/v1/payments/payhero/withdraw-callback/:secret', withdrawCallback);
  app.get('/readyz', async (_req, res) => {
    const dbOk = mongoose.connection.readyState === 1;
    res.status(dbOk ? 200 : 503).json({ db: dbOk, round: engine.live.status });
  });
  app.use('/api/v1', buildApi(engine));
  app.all('*', (req, res) => handle(req, res));

  registerSockets(io, engine);
  await engine.start();
  setInterval(() => void reconcileDeposits().catch((err) => logger.error({ err }, 'reconcile failed')), 60_000).unref();

  ready = true;
  logger.info(`ready on ${env.HOST}:${env.PORT} (${env.NODE_ENV})`);

  const shutdown = async (sig: string) => {
    logger.warn(`${sig} received, shutting down`);
    engine.stop(); // any live round is voided + refunded by recover() on next boot
    await releaseEngineLease();
    io.close(); server.close(); await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
// State may be inconsistent after an uncaught exception: log, then exit so the platform restarts a clean process (unfinished rounds are refunded on boot).
process.on('uncaughtException', (err) => { logger.fatal({ err }, 'uncaughtException - exiting'); setTimeout(() => process.exit(1), 500).unref(); });
main().catch((err) => { logger.fatal({ err }, 'failed to start'); process.exit(1); });
