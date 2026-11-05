import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from './env';
import { User } from './models';
import { AppError } from './money';

export interface AuthedRequest extends Request { auth?: { id: string; role: string; username: string } }

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
/** A REAL bcrypt hash used when the user does not exist, so login takes the same time either way (no account enumeration). */
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-only', 12);

/** Brute-force guard: 5 wrong passwords for the same account from the same IP locks that pair for 15 minutes. */
const fails = new Map<string, { n: number; until: number }>();
setInterval(() => { const now = Date.now(); for (const [k, v] of fails) if (v.until < now) fails.delete(k); }, 10 * 60_000).unref();
export const loginGuard = {
  check(key: string) {
    const f = fails.get(key);
    if (f && f.n >= 5 && f.until > Date.now()) throw new AppError(`Too many failed attempts. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} minute(s).`, 429);
  },
  fail(key: string) { const f = fails.get(key); const n = (f && f.until > Date.now() ? f.n : 0) + 1; fails.set(key, { n, until: Date.now() + 15 * 60_000 }); },
  ok(key: string) { fails.delete(key); },
};

export const signToken = (u: { _id: unknown; tokenVersion: number; role: string }) =>
  jwt.sign({ sub: String(u._id), v: u.tokenVersion, role: u.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'], algorithm: 'HS256' });

/** Validates signature AND that the user still exists, is active and the token version matches (revocation). */
export async function authenticate(token: string | undefined) {
  if (!token) throw new AppError('Authentication required', 401);
  let payload: jwt.JwtPayload;
  try { payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload; }
  catch { throw new AppError('Invalid or expired session', 401); }
  const u = await User.findById(payload.sub).select('username role status tokenVersion');
  if (!u || u.status !== 'active' || u.tokenVersion !== payload.v) throw new AppError('Invalid or expired session', 401);
  return { id: String(u._id), role: u.role, username: u.username };
}

export const requireAuth = async (req: AuthedRequest, _res: Response, next: NextFunction) => {
  try {
    const h = req.headers.authorization;
    req.auth = await authenticate(h?.startsWith('Bearer ') ? h.slice(7) : undefined);
    next();
  } catch (e) { next(e); }
};

export const requireRole = (...roles: string[]) => (req: AuthedRequest, _res: Response, next: NextFunction) =>
  req.auth && roles.includes(req.auth.role) ? next() : next(new AppError('Forbidden', 403));
