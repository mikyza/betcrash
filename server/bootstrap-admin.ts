import { env } from './env';
import { logger } from './logger';
import { User } from './models';
import { hashPassword } from './auth';

export const DEFAULT_ADMIN_EMAIL = 'mike@gmail.com';

/**
 * Runs at boot. When ADMIN_PASSWORD is set, the admin account (ADMIN_EMAIL, default mike@gmail.com) is created or
 * updated so that it is an active admin whose password is exactly ADMIN_PASSWORD.
 * Remove ADMIN_PASSWORD from the environment once you can log in.
 * Public sign-up refuses this email (see /auth/register), so nobody can claim it first.
 */
export async function ensureAdmin() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  if (!env.ADMIN_PASSWORD) {
    logger.warn({ email }, 'ADMIN_PASSWORD is not set - skipping default admin setup');
    return;
  }
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const existing = await User.findOne({ email });
  if (existing) {
    await User.updateOne({ _id: existing._id }, { $set: { role: 'admin', status: 'active', passwordHash }, $inc: { tokenVersion: 1 } });
    logger.info({ email }, 'default admin updated (role=admin, password set from ADMIN_PASSWORD)');
  } else {
    await User.create({ username: 'mike', usernameLower: 'mike', email, passwordHash, role: 'admin', status: 'active', currency: env.DEFAULT_CURRENCY });
    logger.info({ email }, 'default admin created');
  }
}
