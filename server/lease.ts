import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { logger } from './logger';

/** Single-writer lock stored in MongoDB (works on Atlas/Render, no Redis needed). */
const Lease = mongoose.model('Lease', new mongoose.Schema({ _id: String, owner: String, expiresAt: Date }, { versionKey: false }));
const TTL = 20_000;
const id = 'game-engine';
export const instanceId = randomUUID();

const tryAcquire = async () => {
  const now = new Date();
  try {
    await Lease.findOneAndUpdate({ _id: id, $or: [{ owner: instanceId }, { expiresAt: { $lt: now } }] }, { $set: { owner: instanceId, expiresAt: new Date(now.getTime() + TTL) } }, { upsert: true });
    return true;
  } catch (e: any) { if (e?.code === 11000) return false; throw e; } // someone else holds a live lease
};

/**
 * Waits (during a rolling deploy the old instance releases on SIGTERM), then keeps renewing.
 * A transient database error does NOT kill the engine; we only exit if another instance took over,
 * or if we have been unable to prove ownership for almost a full TTL (then someone else may legitimately take it).
 */
export async function acquireEngineLease(waitMs = 60_000) {
  const deadline = Date.now() + waitMs;
  while (!(await tryAcquire())) {
    if (Date.now() > deadline) throw new Error('Another game engine holds the lease. Run exactly one instance.');
    logger.warn('waiting for the previous engine instance to release the lease...');
    await new Promise((r) => setTimeout(r, 3000));
  }
  let lastOk = Date.now();
  setInterval(async () => {
    try {
      if (await tryAcquire()) { lastOk = Date.now(); return; }
      logger.fatal('another instance took the engine lease - exiting so only one engine runs');
      process.exit(1);
    } catch (err) {
      logger.warn({ err }, 'could not renew engine lease');
      if (Date.now() - lastOk > TTL - 4000) { logger.fatal('engine lease expired while the database was unreachable - exiting'); process.exit(1); }
    }
  }, 5000).unref();
}
export const releaseEngineLease = () => Lease.deleteOne({ _id: id, owner: instanceId }).catch(() => undefined);
