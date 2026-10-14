import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env } from '../env';
import { logger } from '../logger';
import { AppError, toMajor } from '../money';
import { Bet, Game, User } from '../models';
import { AuthedRequest, DUMMY_HASH, hashPassword, loginGuard, requireAuth, signToken, verifyPassword } from '../auth';
import { chain } from '../chain';
import { paymentsRouter } from './payments';
import { adminRouter } from './admin';
import type { GameEngine } from '../engine';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req as AuthedRequest, res).catch(next);
const parse = <T extends z.ZodTypeAny>(schema: T, v: unknown): z.infer<T> => {
  const r = schema.safeParse(v);
  if (!r.success) throw new AppError(r.error.issues[0]?.message ?? 'Invalid input', 422);
  return r.data;
};
const publicUser = (u: any) => ({ id: String(u._id), username: u.username, email: u.email, role: u.role, balance: toMajor(u.balance), currency: u.currency, avatar: u.avatar, phone: u.phone, createdAt: u.createdAt });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts, try again later', data: { message: 'Too many attempts, try again later' } } });

export function buildApi(engine: GameEngine) {
  const r = Router();
  r.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests', data: { message: 'Too many requests' } } })); // per-IP flood guard for the whole API

  // ---- auth ----
  r.post('/auth/register', authLimiter, wrap(async (req, res) => {
    const b = parse(z.object({
      username: z.string().trim().regex(/^[A-Za-z0-9_]{3,20}$/, 'Username: 3-20 letters, numbers or _'),
      email: z.string().trim().email(),
      password: z.string().min(8, 'Password must be at least 8 characters').max(128),
      acceptTerms: z.boolean().optional(),
    }), req.body);
    const exists = await User.exists({ $or: [{ usernameLower: b.username.toLowerCase() }, { email: b.email.toLowerCase() }] });
    if (exists) throw new AppError('Username or email already in use', 409);
    const u = await User.create({ username: b.username, usernameLower: b.username.toLowerCase(), email: b.email, passwordHash: await hashPassword(b.password), currency: env.DEFAULT_CURRENCY, acceptedTermsAt: b.acceptTerms ? new Date() : undefined });
    ok(res, { user: publicUser(u) }, 201);
  }));

  r.post('/auth/login', authLimiter, wrap(async (req, res) => {
    const b = parse(z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) }), req.body);
    const id = b.identifier.toLowerCase();
    const guardKey = `${req.ip}|${id}`;
    loginGuard.check(guardKey);
    const u = await User.findOne({ $or: [{ usernameLower: id }, { email: id }] }).select('+passwordHash');
    // same message + the same bcrypt work whether or not the user exists (no account enumeration)
    const valid = await verifyPassword(b.password, u?.passwordHash ?? DUMMY_HASH);
    if (!u || !valid) { loginGuard.fail(guardKey); throw new AppError('Invalid credentials', 401); }
    if (u.status !== 'active') throw new AppError('This account is suspended', 403);
    loginGuard.ok(guardKey);
    u.lastSeen = new Date(); u.lastIp = req.ip; await u.save();
    ok(res, { accessToken: signToken(u), user: publicUser(u) });
  }));

  r.post('/auth/logout', requireAuth, wrap(async (req, res) => { await User.updateOne({ _id: req.auth!.id }, { $inc: { tokenVersion: 1 } }); engine.kickUser(req.auth!.id); ok(res, { loggedOut: true }); }));

  // ---- users ----
  r.get('/users/me', requireAuth, wrap(async (req, res) => ok(res, publicUser(await User.findById(req.auth!.id)))));
  r.patch('/users/me', requireAuth, wrap(async (req, res) => {
    const b = parse(z.object({ avatar: z.string().max(200).regex(/^[\w\-./]*$/, 'Invalid avatar') }), req.body);
    const u = await User.findByIdAndUpdate(req.auth!.id, { avatar: b.avatar }, { new: true });
    ok(res, publicUser(u));
  }));

  r.patch('/users/me/password', authLimiter, requireAuth, wrap(async (req, res) => {
    const b = parse(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128) }), req.body);
    const u = await User.findById(req.auth!.id).select('+passwordHash');
    if (!u || !(await verifyPassword(b.currentPassword, u.passwordHash))) throw new AppError('Current password is incorrect', 400);
    if (b.currentPassword === b.newPassword) throw new AppError('Choose a password different from the current one', 422);
    u.passwordHash = await hashPassword(b.newPassword);
    u.tokenVersion += 1; // signs the user out everywhere
    await u.save();
    engine.kickUser(String(u._id)); // ...including any live game socket
    ok(res, { changed: true });
  }));

  // ---- games / fairness ----
  r.get('/games/config', (_req, res) => ok(res, {
    currency: env.DEFAULT_CURRENCY, minBet: env.MIN_BET, maxBet: env.MAX_BET, maxPayout: env.MAX_PAYOUT, maxMultiplier: env.MAX_MULTIPLIER,
    houseEdgePercent: env.HOUSE_EDGE_PERCENT, rtpPercent: 100 - env.HOUSE_EDGE_PERCENT,
    minDeposit: env.MIN_DEPOSIT, minWithdrawal: env.MIN_WITHDRAWAL,
  }));
  const limitOf = (v: unknown, def: number, max: number) => Math.min(max, Math.max(1, Number(v) || def));
  r.get('/games/history', wrap(async (req, res) => {
    const games = await Game.find({ status: 'crashed' }).sort({ gameNumber: -1 }).limit(limitOf(req.query.limit, 50, 200));
    ok(res, games.map((g) => ({ gameNumber: g.gameNumber, crashPoint: g.crashPoint, startedAt: g.startedAt, crashedAt: g.endedAt, totalBets: g.totalBets, totalPayout: toMajor(g.totalPayout) })));
  }));
  r.get('/games/verify/:gameNumber', wrap(async (req, res) => {
    const g = await Game.findOne({ gameNumber: Number(req.params.gameNumber), status: 'crashed' });
    if (!g) throw new AppError('Round not found or not finished', 404);
    ok(res, { gameNumber: g.gameNumber, crashPoint: g.crashPoint, serverSeed: g.serverSeed, serverSeedHash: g.serverSeedHash, clientSeed: g.clientSeed, houseEdgePercent: env.HOUSE_EDGE_PERCENT });
  }));
  r.get('/games/fairness', wrap(async (_req, res) => ok(res, { algorithm: 'SHA256 hash chain + HMAC-SHA256(serverSeed, clientSeed)', chainLength: env.FAIR_CHAIN_LENGTH, terminalHash: chain.terminal, clientSeed: env.FAIR_CLIENT_SEED, houseEdgePercent: env.HOUSE_EDGE_PERCENT })));

  // ---- bets ----
  r.get('/bets/my', requireAuth, wrap(async (req, res) => {
    const limit = limitOf(req.query.limit, 50, 100); const offset = Math.max(0, Number(req.query.offset) || 0);
    const bets = await Bet.find({ user: req.auth!.id }).sort({ createdAt: -1 }).skip(offset).limit(limit);
    ok(res, { bets: bets.map((b) => ({ id: String(b._id), gameId: String(b.game), betAmount: toMajor(b.amount), betType: b.betType, autoCashOut: b.autoCashOut, status: b.status, cashOutAt: b.cashOutAt, payout: toMajor(b.payout), placedAt: b.createdAt })) });
  }));
  r.get('/bets/top/wins', wrap(async (req, res) => {
    const bets = await Bet.find({ status: 'cashed_out' }).sort({ payout: -1 }).limit(limitOf(req.query.limit, 20, 50));
    ok(res, bets.map((b) => ({ username: b.username, avatar: b.avatar, betAmount: toMajor(b.amount), cashOutAt: b.cashOutAt, payout: toMajor(b.payout), placedAt: b.createdAt })));
  }));
  r.get('/bets/top/multipliers', wrap(async (req, res) => {
    const games = await Game.find({ status: 'crashed' }).sort({ crashPoint: -1 }).limit(limitOf(req.query.limit, 20, 50));
    ok(res, games.map((g) => ({ gameNumber: g.gameNumber, crashPoint: g.crashPoint, totalBets: g.totalBets, date: g.endedAt })));
  }));

  r.use('/payments', paymentsRouter);
  r.use('/admin', adminRouter(engine));

  // ---- errors ----
  r.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return res.status(err.status).json({ success: false, message: err.message, data: { message: err.message } });
    if ((err as { code?: number })?.code === 11000) return res.status(409).json({ success: false, message: 'Duplicate request', data: { message: 'Duplicate request' } });
    logger.error({ err }, 'unhandled API error');
    res.status(500).json({ success: false, message: 'Internal server error', data: { message: 'Internal server error' } });
  });
  return r;
}

