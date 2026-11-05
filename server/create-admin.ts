import { env } from './env';
import { connectDb } from './db';
import { User } from './models';
import { hashPassword } from './auth';
import mongoose from 'mongoose';

(async () => {
  if (!env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD (12+ chars) for this one-off command. The admin email defaults to mike@gmail.com (override with ADMIN_EMAIL).');
  await connectDb();
  const username = 'mike';
  const u = await User.findOneAndUpdate(
    { email: env.ADMIN_EMAIL.toLowerCase() },
    { $set: { role: 'admin', status: 'active', passwordHash: await hashPassword(env.ADMIN_PASSWORD) }, $setOnInsert: { username, usernameLower: username, currency: env.DEFAULT_CURRENCY }, $inc: { tokenVersion: 1 } },
    { upsert: true, new: true },
  );
  console.log(`Admin ready: ${u?.email}. Remove ADMIN_PASSWORD from your environment now.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
