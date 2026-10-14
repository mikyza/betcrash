import { Router, type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env } from '../env';
import { logger } from '../logger';
import { AppError, toMajor, toMinor } from '../money';
import { Payment, User, Withdrawal } from '../models';
import { AuthedRequest, requireAuth } from '../auth';
import { credit, debit, hooks, inTransaction } from '../wallet';
import { normalizePhone, stkPush, verifyTransaction } from '../payhero';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req as AuthedRequest, res).catch(next);
const secretOk = (given: string) => { const a = Buffer.from(given), b = Buffer.from(env.PAYHERO_CALLBACK_SECRET); return a.length === b.length && timingSafeEqual(a, b); };
const money = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => (req as AuthedRequest).auth?.id ?? req.ip ?? 'anon', validate: false, message: { success: false, message: 'Too many requests, slow down', data: { message: 'Too many requests, slow down' } } });

// ---------------------------------------------------------------- deposits (C2B)
/** Idempotent: callback + reconcile job can both call it; money is credited once (status flip + unique receipt + unique ledger ref). */
export async function settleDeposit(paymentId: string, receipt?: string) {
  const done = await inTransaction(async (s) => {
    const p = await Payment.findOneAndUpdate({ _id: paymentId, status: 'pending' }, { status: 'paid', ...(receipt ? { mpesaReceipt: receipt } : {}) }, { new: true, session: s });
    if (!p) return null;
    const balance = await credit(s, p.user, p.amount, 'deposit', String(p._id), { receipt, phone: p.phone });
    await User.updateOne({ _id: p.user }, { $inc: { totalDeposits: p.amount } }, { session: s });
    return { user: String(p.user), balance };
  });
  if (done) hooks.onBalance(done.user, done.balance);
  return !!done;
}

export const paymentsRouter = Router();

paymentsRouter.post('/deposit', requireAuth, money, wrap(async (req, res) => {
  const b = z.object({ amount: z.number().int().min(env.MIN_DEPOSIT, `Minimum deposit is ${env.MIN_DEPOSIT}`).max(env.MAX_DEPOSIT, `Maximum deposit is ${env.MAX_DEPOSIT}`), phone: z.string().min(9).max(16) }).safeParse(req.body);
  if (!b.success) throw new AppError(b.error.issues[0]?.message ?? 'Invalid input', 422);
  const phone = normalizePhone(b.data.phone);
  if (!phone) throw new AppError('Enter a valid Safaricom number e.g. 0712345678', 422);
  const user = await User.findById(req.auth!.id);
  if (!user || user.status !== 'active') throw new AppError('Account unavailable', 403);
  const recent = await Payment.countDocuments({ user: user._id, status: 'pending', createdAt: { $gte: new Date(Date.now() - 10 * 60_000) } });
  if (recent >= 3) throw new AppError('You have pending deposits. Complete or wait for them before trying again.', 429);

  const _id = new Types.ObjectId();
  const p = await Payment.create({ _id, user: user._id, externalReference: `dep_${_id}`, phone, amount: toMinor(b.data.amount), currency: user.currency });
  try {
    const r = await stkPush({ amount: b.data.amount, phone, externalReference: p.externalReference, customerName: user.username });
    p.payheroReference = r.reference; p.checkoutRequestId = r.checkoutRequestId; await p.save();
  } catch (e) { p.status = 'failed'; p.failureReason = 'stk push not sent'; await p.save(); throw e; }
  if (user.phone !== phone) await User.updateOne({ _id: user._id }, { phone });
  ok(res, { paymentId: String(p._id), status: 'pending', message: 'Check your phone and enter your M-Pesa PIN' }, 202);
}));

paymentsRouter.get('/deposit/:id', requireAuth, wrap(async (req, res) => {
  if (!Types.ObjectId.isValid(String(req.params.id))) throw new AppError('Invalid id', 422);
  const p = await Payment.findOne({ _id: req.params.id, user: req.auth!.id });
  if (!p) throw new AppError('Not found', 404);
  ok(res, { status: p.status, amount: toMajor(p.amount), receipt: p.mpesaReceipt, failureReason: p.failureReason });
}));

/** PayHero posts here. The URL carries a secret; success is additionally confirmed with PayHero's authenticated API. */
export const depositCallback = async (req: Request, res: Response) => {
  try {
    if (!secretOk(String(req.params.secret))) return res.status(404).end();
    const r = req.body?.response ?? req.body ?? {};
    const ref = String(r.ExternalReference ?? r.external_reference ?? '');
    const p = ref ? await Payment.findOne({ externalReference: ref }) : null;
    if (!p) { logger.warn({ ref }, 'deposit callback for unknown reference'); return res.status(200).json({ ok: true }); }
    if (p.status !== 'pending') return res.status(200).json({ ok: true });
    if (r.CheckoutRequestID && p.checkoutRequestId && r.CheckoutRequestID !== p.checkoutRequestId) { logger.error({ ref }, 'checkout id mismatch'); return res.status(200).json({ ok: true }); }

    const claimedOk = Number(r.ResultCode) === 0 && String(r.Status ?? 'Success').toLowerCase() === 'success';
    if (!claimedOk) {
      if ((await verifyTransaction(p.payheroReference)) !== 'success') { await Payment.updateOne({ _id: p._id, status: 'pending' }, { status: 'failed', failureReason: String(r.ResultDesc ?? r.Status ?? 'failed').slice(0, 120) }); }
      return res.status(200).json({ ok: true });
    }
    const paid = Number(r.Amount);
    if (Number.isFinite(paid) && toMinor(paid) !== p.amount) { logger.error({ ref, paid, expected: toMajor(p.amount) }, 'AMOUNT MISMATCH - not crediting, resolve manually'); await Payment.updateOne({ _id: p._id }, { failureReason: `amount mismatch: paid ${paid}` }); return res.status(200).json({ ok: true }); }
    const v = await verifyTransaction(p.payheroReference);
    if (v !== 'success') { logger.warn({ ref, v }, 'callback says success but PayHero API does not confirm yet; reconcile job will retry'); return res.status(202).json({ ok: true }); }
    await settleDeposit(String(p._id), r.MpesaReceiptNumber ? String(r.MpesaReceiptNumber) : undefined);
    res.status(200).json({ ok: true });
  } catch (err) { logger.error({ err }, 'deposit callback error'); res.status(500).end(); }
};

/** Safety net: pending deposits whose callback was lost/unconfirmed are checked against PayHero every minute. */
export async function reconcileDeposits() {
  if (!env.PAYHERO_VERIFY_WITH_API) return;
  const rows = await Payment.find({ status: 'pending', payheroReference: { $exists: true }, createdAt: { $lte: new Date(Date.now() - 60_000), $gte: new Date(Date.now() - 24 * 3600_000) } }).limit(50);
  for (const p of rows) {
    const v = await verifyTransaction(p.payheroReference);
    if (v === 'success') await settleDeposit(String(p._id));
    else if (v === 'failed') await Payment.updateOne({ _id: p._id, status: 'pending' }, { status: 'failed', failureReason: 'failed at provider' });
  }
}

// ---------------------------------------------------------------- withdrawals (B2C)
paymentsRouter.post('/withdraw', requireAuth, money, wrap(async (req, res) => {
  const b = z.object({ amount: z.number().int().min(env.MIN_WITHDRAWAL, `Minimum withdrawal is ${env.MIN_WITHDRAWAL}`).max(env.MAX_WITHDRAWAL, `Maximum withdrawal is ${env.MAX_WITHDRAWAL}`), phone: z.string().min(9).max(16) }).safeParse(req.body);
  if (!b.success) throw new AppError(b.error.issues[0]?.message ?? 'Invalid input', 422);
  const phone = normalizePhone(b.data.phone);
  if (!phone) throw new AppError('Enter a valid Safaricom number e.g. 0712345678', 422);
  const open = await Withdrawal.countDocuments({ user: req.auth!.id, status: { $in: ['pending', 'processing'] } });
  if (open >= 2) throw new AppError('You already have withdrawals in progress', 429);
  const minor = toMinor(b.data.amount);
  const out = await inTransaction(async (s) => {
    const [w] = await Withdrawal.create([{ user: req.auth!.id, amount: minor, currency: env.DEFAULT_CURRENCY, method: 'M-Pesa', accountDetails: phone }], { session: s });
    const balance = await debit(s, req.auth!.id, minor, 'withdrawal', String(w._id)); // funds are held immediately
    return { id: String(w._id), balance };
  });
  hooks.onBalance(req.auth!.id, out.balance);
  ok(res, { id: out.id, status: 'pending', balance: toMajor(out.balance) }, 201);
}));

paymentsRouter.get('/my', requireAuth, wrap(async (req, res) => {
  const [deps, wds] = await Promise.all([Payment.find({ user: req.auth!.id }).sort({ createdAt: -1 }).limit(20), Withdrawal.find({ user: req.auth!.id }).sort({ createdAt: -1 }).limit(20)]);
  ok(res, { deposits: deps.map((d) => ({ id: String(d._id), amount: toMajor(d.amount), status: d.status, receipt: d.mpesaReceipt, at: d.createdAt })), withdrawals: wds.map((w) => ({ id: String(w._id), amount: toMajor(w.amount), status: w.status, receipt: w.mpesaReceipt, at: w.createdAt })) });
}));

/** Finalise a withdrawal that is `processing`. paid -> approved; failed -> refund. Idempotent. */
export async function finishWithdrawal(id: string, outcome: 'paid' | 'failed', info: { receipt?: string; note?: string; by?: string } = {}) {
  const r = await inTransaction(async (s) => {
    const w = await Withdrawal.findOneAndUpdate({ _id: id, status: 'processing' }, { status: outcome === 'paid' ? 'approved' : 'failed', mpesaReceipt: info.receipt, ...(info.note ? { adminNote: info.note } : {}), processedAt: new Date(), ...(info.by ? { processedBy: info.by } : {}) }, { new: true, session: s });
    if (!w) return null;
    if (outcome === 'paid') { await User.updateOne({ _id: w.user }, { $inc: { totalWithdrawals: w.amount } }, { session: s }); return { user: String(w.user), balance: null }; }
    return { user: String(w.user), balance: await credit(s, w.user, w.amount, 'withdrawal_refund', String(w._id)) };
  });
  if (r?.balance != null) hooks.onBalance(r.user, r.balance);
  return !!r;
}

export const withdrawCallback = async (req: Request, res: Response) => {
  try {
    if (!secretOk(String(req.params.secret))) return res.status(404).end();
    const r = req.body?.response ?? req.body ?? {};
    const ref = String(r.ExternalReference ?? r.external_reference ?? '');
    const w = ref ? await Withdrawal.findOne({ payoutReference: ref, status: 'processing' }) : null;
    if (!w) return res.status(200).json({ ok: true });
    const status = String(r.Status ?? r.status ?? '').toLowerCase();
    const code = r.ResultCode ?? r.result_code;
    const claimedPaid = status === 'success' || status === 'successful' || status === 'completed' || (code !== undefined && Number(code) === 0 && !status.startsWith('fail'));
    const claimedFailed = status.startsWith('fail') || status === 'cancelled' || (code !== undefined && Number(code) !== 0);
    if (!claimedPaid && !claimedFailed) return res.status(200).json({ ok: true }); // ambiguous: stays `processing` for an admin to resolve
    const v = await verifyTransaction(String(r.reference ?? w.payoutReference));
    // Never move money on an unconfirmed claim: a forged "failed" would refund a payout that really went out.
    if (claimedPaid && v === 'success') await finishWithdrawal(String(w._id), 'paid', { receipt: r.MpesaReceiptNumber ? String(r.MpesaReceiptNumber) : undefined });
    else if (claimedFailed && v === 'failed') await finishWithdrawal(String(w._id), 'failed', { note: String(r.ResultDesc ?? 'payout failed').slice(0, 200) });
    else logger.warn({ ref, v, claimedPaid, claimedFailed }, 'withdraw callback unconfirmed - left in processing for admin');
    res.status(200).json({ ok: true });
  } catch (err) { logger.error({ err }, 'withdraw callback error'); res.status(500).end(); }
};
