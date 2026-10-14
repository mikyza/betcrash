import { env } from './env';

/**
 * Wallet limits in MAJOR units (rupees). MIN_DEPOSIT / MIN_WITHDRAWAL come from env (defaults 10 / 100),
 * and the frontend reads them from GET /api/v1/payments/limits, so the UI can never disagree with the server.
 */
export const LIMITS = {
  MIN_DEPOSIT: env.MIN_DEPOSIT,
  MAX_DEPOSIT: 500_000,
  MIN_WITHDRAWAL: env.MIN_WITHDRAWAL,
  MAX_WITHDRAWAL: 500_000,
  MAX_PENDING_WITHDRAWALS: 3,
} as const;

export const WITHDRAWAL_METHODS = ['UPI', 'Bank'] as const;
