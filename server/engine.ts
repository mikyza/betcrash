import { performance } from 'perf_hooks';
import type { Server } from 'socket.io';
import { Types } from 'mongoose';
import { env } from './env';
import { logger } from './logger';
import { Bet, Game, User } from './models';
import { AppError, toMajor, toMinor } from './money';
import { crashPointFrom, multiplierAt, timeToReach, sha256 } from './fairness';
import { chain } from './chain';
import { credit, debit, inTransaction } from './wallet';

type Phase = 'betting' | 'playing' | 'crashed';
type BetType = 'first' | 'second';

interface LiveBet {
  id: string; userId: string; username: string; avatar: string; betType: BetType;
  amount: number; currency: string; autoCashOut: number | null; placedAt: number;
  status: 'active' | 'cashed_out'; cashOutAt?: number; payout?: number;
}

const TICK_MS = 50;
const BROADCAST_EVERY = 2; // every 2nd tick = 100ms

export class GameEngine {
  private phase: Phase = 'crashed';
  private gameId = '';
  private gameNumber = 0;
  private seed = '';
  private crashPoint = 1;
  private crashAtMs = 0;
  private startedAt = 0;
  private bettingEndsAt = 0;
  private bets = new Map<string, LiveBet>(); // key userId:betType
  private pending = new Set<Promise<unknown>>();
  private busyUsers = new Set<string>();
  private timer?: NodeJS.Timeout;
  private tickCount = 0;
  private stopped = false;

  constructor(private io: Server) {}

  /** Void any round that was in flight when the process died and refund every active stake. */
  async recover() {
    const open = await Game.find({ status: { $in: ['betting', 'playing'] } });
    for (const g of open) {
      const bets = await Bet.find({ game: g._id, status: 'active' });
      for (const b of bets) {
        await inTransaction(async (s) => {
          const r = await Bet.updateOne({ _id: b._id, status: 'active' }, { status: 'refunded' }, { session: s });
          if (r.modifiedCount === 1) await credit(s, b.user, b.amount, 'bet_refund', String(b._id));
        });
      }
      g.status = 'voided'; g.endedAt = new Date(); await g.save();
      logger.warn({ game: g.gameNumber, refunded: bets.length }, 'voided unfinished round after restart');
    }
  }

  async start() { await this.recover(); void this.beginRound(); }
  kickUser(userId: string) { this.io.in(`user:${userId}`).disconnectSockets(true); }
  stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); }

  // ---------- public read API ----------
  snapshot() {
    const all = [...this.bets.values()];
    const mapBet = (b: LiveBet) => ({
      id: b.id, userId: b.userId, username: b.username, avatar: b.avatar, betAmount: toMajor(b.amount),
      betType: b.betType, autoCashOut: b.autoCashOut, currency: b.currency, placedAt: b.placedAt,
    });
    return {
      gameId: this.gameId, gameNumber: this.gameNumber, status: this.phase,
      currentMultiplier: this.phase === 'playing' ? this.currentMultiplier() : 1,
      timeElapsed: this.phase === 'playing' ? this.elapsed() : 0,
      bettingEndsAt: this.bettingEndsAt,
      activeBets: all.filter((b) => b.status === 'active').map(mapBet),
      cashedOutBets: all.filter((b) => b.status === 'cashed_out').map((b) => ({ ...mapBet(b), cashOutAt: b.cashOutAt!, payout: toMajor(b.payout!) })),
    };
  }
  get live() { return { id: this.gameId, status: this.phase, multiplier: this.phase === 'playing' ? this.currentMultiplier() : 1 }; }
  /** Monotonic clock (immune to NTP / wall-clock jumps) - the flight is timed with this, never with Date.now(). */
  private elapsed() { return performance.now() - this.startedAt; }
  private currentMultiplier() { return Math.min(multiplierAt(this.elapsed()), this.crashPoint); }

  // ---------- round lifecycle ----------
  private async beginRound() {
    if (this.stopped) return;
    try {
      const last = await Game.findOne().sort({ gameNumber: -1 }).select('gameNumber');
      const n = (last?.gameNumber ?? 0) + 1;
      if (n >= env.FAIR_CHAIN_LENGTH * 0.9 && n % 100 === 0) logger.warn({ n, length: env.FAIR_CHAIN_LENGTH }, 'FAIRNESS CHAIN ALMOST EXHAUSTED - rotate FAIR_CHAIN_ROOT/LENGTH soon');
      this.seed = chain.seedFor(n);
      this.crashPoint = crashPointFrom(this.seed, env.FAIR_CLIENT_SEED, env.HOUSE_EDGE_PERCENT, env.MAX_MULTIPLIER);
      this.crashAtMs = timeToReach(this.crashPoint);
      // commitment = previous round's revealed seed (== sha256(this.seed)); crashPoint is NOT stored until the crash
      const game = await Game.create({ gameNumber: n, status: 'betting', serverSeedHash: sha256(this.seed), clientSeed: env.FAIR_CLIENT_SEED });
      this.gameId = String(game._id); this.gameNumber = n; this.bets.clear(); this.phase = 'betting';
      this.bettingEndsAt = Date.now() + env.BETTING_MS;
      this.io.emit('gameStart', { gameId: this.gameId, gameNumber: n, bettingEndsAt: this.bettingEndsAt, serverSeedHash: game.serverSeedHash });
      this.timer = setTimeout(() => void this.takeOff(), env.BETTING_MS);
    } catch (err) {
      logger.error({ err }, 'beginRound failed; retrying in 5s');
      this.timer = setTimeout(() => void this.beginRound(), 5000);
    }
  }

  private async takeOff() {
    await Promise.allSettled([...this.pending]); // let in-flight bets finish before closing the book
    this.phase = 'playing'; this.startedAt = performance.now(); this.tickCount = 0;
    await Game.updateOne({ _id: this.gameId }, { status: 'playing', startedAt: new Date() });
    this.io.emit('gamePhase', { status: 'playing' });
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    const elapsed = this.elapsed();
    if (elapsed >= this.crashAtMs) { clearInterval(this.timer); void this.crash(); return; }
    const m = multiplierAt(elapsed);
    for (const b of this.bets.values()) {
      if (b.status === 'active' && b.autoCashOut && m >= b.autoCashOut) this.track(this.settleWin(b, b.autoCashOut).catch(() => undefined));
    }
    if (++this.tickCount % BROADCAST_EVERY === 0) this.io.emit('gameTick', { currentMultiplier: m, timeElapsed: elapsed });
  }

  private async crash() {
    this.phase = 'crashed';
    // anyone whose auto cash-out target <= crash point wins, even if the crash fell between ticks
    for (const b of this.bets.values()) if (b.status === 'active' && b.autoCashOut && b.autoCashOut <= this.crashPoint) this.track(this.settleWin(b, b.autoCashOut).catch(() => undefined));
    await Promise.allSettled([...this.pending]);
    try {
      const lost = await Bet.updateMany({ game: this.gameId, status: 'active' }, { status: 'lost' });
      const agg = await Bet.aggregate([{ $match: { game: new Types.ObjectId(this.gameId) } }, { $group: { _id: null, wagered: { $sum: '$amount' }, payout: { $sum: '$payout' }, n: { $sum: 1 } } }]);
      const { wagered = 0, payout = 0, n = 0 } = agg[0] ?? {};
      await Game.updateOne({ _id: this.gameId }, { status: 'crashed', crashPoint: this.crashPoint, serverSeed: this.seed, endedAt: new Date(), totalBets: n, totalWagered: wagered, totalPayout: payout, houseProfit: wagered - payout });
      logger.info({ game: this.gameNumber, crash: this.crashPoint, bets: n, lost: lost.modifiedCount }, 'round complete');
    } catch (err) { logger.error({ err, game: this.gameNumber }, 'failed to finalize round'); }
    this.io.emit('gameCrash', { gameId: this.gameId, gameNumber: this.gameNumber, crashPoint: this.crashPoint, serverSeed: this.seed });
    this.timer = setTimeout(() => void this.beginRound(), env.CRASH_PAUSE_MS);
  }

  // ---------- player actions ----------
  async placeBet(userId: string, input: { betAmount: number; betType: BetType; autoCashOut?: number | null }) {
    if (this.phase !== 'betting' || Date.now() >= this.bettingEndsAt) throw new AppError('Betting is closed for this round');
    const minor = toMinor(Number(input.betAmount));
    if (!Number.isFinite(minor) || minor < toMinor(env.MIN_BET) || minor > toMinor(env.MAX_BET)) throw new AppError(`Bet must be between ${env.MIN_BET} and ${env.MAX_BET}`);
    if (input.betType !== 'first' && input.betType !== 'second') throw new AppError('Invalid bet slot');
    let auto = input.autoCashOut ? Math.round(Number(input.autoCashOut) * 100) / 100 : null;
    if (auto !== null && (!(auto >= 1.01) || auto > env.MAX_MULTIPLIER)) throw new AppError('Invalid auto cash-out');
    // Maximum win per bet: the bet is automatically cashed out when it reaches MAX_PAYOUT (published in the rules).
    const capMult = Math.floor((toMinor(env.MAX_PAYOUT) / minor) * 100) / 100;
    if (capMult < 1.01) throw new AppError(`Bet too large: maximum win per bet is ${env.MAX_PAYOUT}`);
    if (capMult < env.MAX_MULTIPLIER && (auto === null || auto > capMult)) auto = capMult;
    const key = `${userId}:${input.betType}`;
    if (this.bets.has(key) || this.busyUsers.has(key)) throw new AppError('You already have a bet in this slot');
    this.busyUsers.add(key);
    const gameId = this.gameId;
    const work = (async () => {
      const user = await User.findById(userId).select('username avatar currency status');
      if (!user || user.status !== 'active') throw new AppError('Account unavailable', 403);
      const betId = new Types.ObjectId();
      const balance = await inTransaction(async (s) => {
        await Bet.create([{ _id: betId, game: gameId, gameNumber: this.gameNumber, user: userId, username: user.username, avatar: user.avatar, betType: input.betType, amount: minor, currency: user.currency, autoCashOut: auto }], { session: s });
        return debit(s, userId, minor, 'bet', String(betId));
      });
      if (this.phase !== 'betting' || gameId !== this.gameId) {
        // Round closed while we were writing: give the stake straight back instead of leaving it for recover().
        const refunded = await inTransaction(async (s) => {
          await Bet.updateOne({ _id: betId, status: 'active' }, { status: 'refunded' }, { session: s });
          return credit(s, userId, minor, 'bet_refund', String(betId));
        });
        this.io.to(`user:${userId}`).emit('balanceUpdate', { balance: toMajor(refunded) });
        throw new AppError('Betting closed - your stake was returned');
      }
      const live: LiveBet = { id: String(betId), userId, username: user.username, avatar: user.avatar, betType: input.betType, amount: minor, currency: user.currency, autoCashOut: auto, placedAt: Date.now(), status: 'active' };
      this.bets.set(key, live);
      this.io.emit('betPlaced', { gameId, bet: { id: live.id, userId, username: live.username, avatar: live.avatar, betAmount: toMajor(minor), betType: live.betType, autoCashOut: auto, currency: live.currency, placedAt: live.placedAt } });
      this.io.to(`user:${userId}`).emit('balanceUpdate', { balance: toMajor(balance) });
    })().finally(() => this.busyUsers.delete(key));
    this.track(work.catch(() => undefined));
    await work;
  }

  async cashOut(userId: string, betType: BetType) {
    if (this.phase !== 'playing') throw new AppError('Round is not in progress');
    const b = this.bets.get(`${userId}:${betType}`);
    if (!b || b.status !== 'active') throw new AppError('No active bet to cash out');
    const m = multiplierAt(this.elapsed()); // server clock only - the client never supplies a multiplier
    if (m >= this.crashPoint) throw new AppError('Too late - the plane flew away');
    const work = this.settleWin(b, m);
    this.track(work.catch(() => undefined));
    await work;
  }

  private async settleWin(b: LiveBet, multiplier: number) {
    if (b.status !== 'active') return; // JS is single-threaded: first caller flips the flag, later callers return
    b.status = 'cashed_out'; b.cashOutAt = multiplier;
    const payout = Math.floor((b.amount * Math.round(multiplier * 100)) / 100);
    b.payout = payout;
    try {
      const balance = await inTransaction(async (s) => {
        const r = await Bet.updateOne({ _id: b.id, status: 'active' }, { status: 'cashed_out', cashOutAt: multiplier, payout }, { session: s });
        if (r.modifiedCount !== 1) throw new AppError('Bet already settled');
        return credit(s, b.userId, payout, 'win', b.id);
      });
      this.io.emit('playerCashOut', { userId: b.userId, username: b.username, cashOutAt: multiplier, betType: b.betType, payout: toMajor(payout) });
      this.io.emit('betCashedOut', { userId: b.userId, username: b.username, cashOutAt: multiplier, betType: b.betType });
      this.io.to(`user:${b.userId}`).emit('balanceUpdate', { balance: toMajor(balance) });
    } catch (err) {
      b.status = 'active'; delete b.cashOutAt; delete b.payout; // allow retry (auto cash-out retries next tick)
      logger.error({ err, bet: b.id }, 'settleWin failed');
      throw err;
    }
  }

  private track(p: Promise<unknown>) { this.pending.add(p); void p.finally(() => this.pending.delete(p)); }
}
