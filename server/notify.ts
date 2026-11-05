import { logger } from './logger';
import { Notification, User } from './models';

export type NotificationType = 'deposit' | 'withdrawal' | 'win' | 'security' | 'system' | 'admin';
export interface NotificationInput { type: NotificationType; title: string; message?: string; link?: string }

export const toClient = (n: any) => ({
  id: String(n._id), type: n.type, title: n.title, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt,
});

/** Set by server.ts so notifications reach the browser live. Without it they are still saved and show up on next load. */
export const notifyHooks = {
  push: (_userId: string, _n: ReturnType<typeof toClient>) => {},
  broadcast: (_payload: { title: string; message: string }) => {},
};

/** Never throws: a failed notification must not break a deposit, withdrawal or game round. */
export async function notifyUser(userId: string, input: NotificationInput) {
  try {
    const n = await Notification.create({ user: userId, ...input });
    notifyHooks.push(String(userId), toClient(n));
  } catch (err) { logger.warn({ err }, 'notifyUser failed'); }
}

/** Every admin gets their own copy (so each can mark it read separately). */
export async function notifyAdmins(input: NotificationInput) {
  try {
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
    await Promise.all(admins.map((a) => notifyUser(String(a._id), { link: '/admin', ...input })));
  } catch (err) { logger.warn({ err }, 'notifyAdmins failed'); }
}
