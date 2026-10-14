// All balances are stored as INTEGER minor units (paise/cents). Floats never touch the ledger.
export const toMinor = (major: number): number => Math.round(major * 100);
export const toMajor = (minor: number): number => minor / 100;

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
