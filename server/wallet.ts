import mongoose, { ClientSession } from 'mongoose';
import { Transaction, User } from './models';
import { AppError } from './money';

/** Set by server.ts so wallet changes made outside a socket (payment callbacks) still reach the player's screen. */
export const hooks = { onBalance: (_userId: string, _balanceMinor: number) => {} };

type TxType = 'deposit' | 'withdrawal' | 'withdrawal_refund' | 'bet' | 'win' | 'bet_refund' | 'adjustment';

/** Run fn inside a Mongo transaction (auto-retries transient errors). */
export const inTransaction = async <T>(fn: (s: ClientSession) => Promise<T>): Promise<T> => {
  const session = await mongoose.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => { out = await fn(session); });
    return out;
  } finally {
    await session.endSession();
  }
};

/** Atomically debit; fails (never goes negative) if funds are insufficient or the user is banned. */
export async function debit(s: ClientSession, userId: string | mongoose.Types.ObjectId, minor: number, type: TxType, ref?: string, meta?: object) {
  if (!Number.isInteger(minor) || minor <= 0) throw new AppError('Invalid amount');
  const u = await User.findOneAndUpdate(
    { _id: userId, status: 'active', balance: { $gte: minor } },
    { $inc: { balance: -minor } },
    { new: true, session: s },
  );
  if (!u) throw new AppError('Insufficient balance');
  await Transaction.create([{ user: u._id, type, amount: -minor, balanceAfter: u.balance, currency: u.currency, ref, meta }], { session: s });
  return u.balance;
}

/** Atomically credit. `ref`+`type` is unique, so replaying the same payout/deposit is a no-op error, not a double credit. */
export async function credit(s: ClientSession, userId: string | mongoose.Types.ObjectId, minor: number, type: TxType, ref?: string, meta?: object) {
  if (!Number.isInteger(minor) || minor < 0) throw new AppError('Invalid amount');
  const u = await User.findOneAndUpdate({ _id: userId }, { $inc: { balance: minor } }, { new: true, session: s });
  if (!u) throw new AppError('User not found', 404);
  await Transaction.create([{ user: u._id, type, amount: minor, balanceAfter: u.balance, currency: u.currency, ref, meta }], { session: s });
  return u.balance;
}
