import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { authenticate } from './auth';
import type { GameEngine } from './engine';
import { logger } from './logger';
import { ChatMessage } from './models';
import { AppError, toMajor } from './money';
import { User } from './models';

const GIF_HOSTS = new Set(['media.giphy.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com', 'i.giphy.com', 'media.tenor.com', 'c.tenor.com']);
const chatOut = (m: any) => ({ id: String(m._id), userId: String(m.user), username: m.username, avatar: m.avatar, message: m.message, type: m.type, likes: m.likes.length });

/** Tiny fixed-window limiter per socket: `max` events per `windowMs`. */
const limiter = (max: number, windowMs: number) => { let start = Date.now(), n = 0; return () => { const now = Date.now(); if (now - start > windowMs) { start = now; n = 0; } return ++n <= max; }; };

export function registerSockets(io: Server, engine: GameEngine) {
  // Guests may watch; a bad token is rejected rather than silently downgraded.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try { socket.data.user = await authenticate(token); next(); } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as { id: string; username: string } | undefined;
    const allow = limiter(20, 5000);
    const chatAllow = limiter(3, 6000);
    const guard = (fn: (data: unknown) => Promise<void>, errEvent: string) => async (data: unknown) => {
      try {
        if (!allow()) throw new AppError('Slow down');
        if (!user) throw new AppError('Please log in', 401);
        await fn(data);
      } catch (e) {
        const message = e instanceof AppError || e instanceof z.ZodError ? (e instanceof z.ZodError ? 'Invalid request' : e.message) : 'Something went wrong';
        if (!(e instanceof AppError) && !(e instanceof z.ZodError)) logger.error({ err: e }, `${errEvent} failed`);
        socket.emit(errEvent, { message });
      }
    };

    socket.emit('gameState', engine.snapshot());
    const history = await ChatMessage.find().sort({ createdAt: -1 }).limit(50).lean();
    socket.emit('chatHistory', history.reverse().map(chatOut));
    if (user) {
      socket.join(`user:${user.id}`);
      const u = await User.findById(user.id).select('balance');
      if (u) socket.emit('balanceUpdate', { balance: toMajor(u.balance) });
    }
    socket.on('enterRoom', () => socket.emit('connected', { message: 'Connected to game room' }));

    socket.on('placeBet', guard(async (d) => {
      const b = z.object({ betAmount: z.number().finite(), betType: z.enum(['first', 'second']), autoCashOut: z.number().finite().nullable().optional() }).parse(d);
      await engine.placeBet(user!.id, b);
    }, 'betError'));

    socket.on('cashOut', guard(async (d) => {
      const b = z.object({ betType: z.enum(['first', 'second']) }).parse(d);
      await engine.cashOut(user!.id, b.betType);
    }, 'cashOutError'));

    socket.on('sendMessage', guard(async (d) => {
      if (!chatAllow()) throw new AppError('You are sending messages too fast');
      const b = z.object({ message: z.string().trim().min(1).max(300), type: z.enum(['text', 'gif']).default('text') }).parse(d);
      if (b.type === 'gif') { const u = new URL(b.message); if (u.protocol !== 'https:' || !GIF_HOSTS.has(u.hostname)) throw new AppError('Unsupported GIF source'); }
      const u = await User.findById(user!.id).select('username avatar status');
      if (!u || u.status !== 'active') throw new AppError('Account unavailable', 403);
      const m = await ChatMessage.create({ user: u._id, username: u.username, avatar: u.avatar, message: b.message, type: b.type });
      io.emit('chatMessage', chatOut(m));
    }, 'chatError'));

    socket.on('likeMessage', guard(async (d) => {
      const b = z.object({ messageId: z.string().regex(/^[a-f\d]{24}$/i) }).parse(d);
      const m = await ChatMessage.findById(b.messageId);
      if (!m) return;
      const has = m.likes.includes(user!.id);
      await ChatMessage.updateOne({ _id: m._id }, has ? { $pull: { likes: user!.id } } : { $addToSet: { likes: user!.id } });
    }, 'chatError'));
  });
}
