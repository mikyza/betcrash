import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected (driver will retry)'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB, maxPoolSize: 50, serverSelectionTimeoutMS: 10000, retryWrites: true, w: 'majority' });
  // Transactions need a replica set; fail loudly at boot, not at the first bet.
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) {
    throw new Error('MongoDB is not a replica set. Transactions (wallet safety) require one - use Atlas or `--replSet rs0`.');
  }
  // The unique indexes (one bet per slot, one ledger row per payout, one M-Pesa receipt once) ARE the money-safety net.
  // Make sure they exist before serving traffic; refuse to start if one cannot be built (e.g. duplicate data).
  await import('./models');
  await Promise.all((Object.values(mongoose.models) as mongoose.Model<any>[]).map((m) => m.init()));
  logger.info('MongoDB connected (replica set %s), indexes ready', hello.setName);
}
