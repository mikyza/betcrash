import mongoose from 'mongoose';
import { connectDb } from './db';
import { Transaction, User } from './models';
import { toMajor } from './money';

/**
 * Reconciliation: every balance must equal the sum of that user's ledger rows (all changes go through the ledger).
 * Run it after launch daily (`npm run audit-ledger`). A mismatch means a balance was edited by hand or a bug exists.
 */
(async () => {
  await connectDb();
  const sums = await Transaction.aggregate([{ $group: { _id: '$user', sum: { $sum: '$amount' }, n: { $sum: 1 } } }]);
  const sumBy = new Map<string, number>(sums.map((s) => [String(s._id), s.sum]));
  const users = await User.find().select('username balance');
  let bad = 0, total = 0;
  for (const u of users) {
    total += u.balance;
    const expected = sumBy.get(String(u._id)) ?? 0;
    if (expected !== u.balance) { bad++; console.log(`MISMATCH ${u.username}: balance ${toMajor(u.balance)} but ledger says ${toMajor(expected)} (diff ${toMajor(u.balance - expected)})`); }
  }
  console.log(`${users.length} users checked, total player balances ${toMajor(total)}, mismatches: ${bad}`);
  await mongoose.disconnect();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
