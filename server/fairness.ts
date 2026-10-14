import { createHash, createHmac } from 'crypto';

export const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');

/**
 * Hash chain: seed(n) = SHA256^(L-n)(root). Round n's commitment is seed(n-1) = SHA256(seed(n)),
 * which was already revealed when round n-1 crashed. The terminal hash SHA256^L(root) is published once,
 * so the operator cannot cherry-pick seeds after the fact.
 */
export function seedForRound(root: string, length: number, n: number): string {
  if (n < 1 || n > length) throw new Error(`Fairness chain exhausted or invalid index (${n}/${length}) - rotate the chain`);
  let h = root;
  for (let i = 0; i < length - n; i++) h = sha256(h);
  return h;
}
/**
 * Same chain, but with checkpoints every K hashes so deriving any round's seed costs <= K hashes (sub-millisecond)
 * instead of up to L hashes. One pass over L hashes at boot (~1s per million).
 */
export function buildChain(root: string, length: number, K = 1000) {
  const cps: string[] = [];
  let h = root;
  for (let i = 0; i <= length; i++) { if (i % K === 0) cps.push(h); if (i < length) h = sha256(h); }
  return {
    terminal: h,
    seedFor(n: number): string {
      if (n < 1 || n > length) throw new Error(`Fairness chain exhausted or invalid index (${n}/${length}) - rotate the chain`);
      const e = length - n; // number of hashes from root
      let x = cps[Math.floor(e / K)];
      for (let i = 0; i < e % K; i++) x = sha256(x);
      return x;
    },
  };
}

/** Published once at /games/fairness. Anyone can check SHA256(seed(1)) chains up to this. */
export function terminalHash(root: string, length: number) {
  let h = root;
  for (let i = 0; i < length; i++) h = sha256(h);
  return h;
}

/**
 * Crash multiplier (2dp) from a server seed + public client seed.
 * r = h/2^52 is uniform in [0,1); crash = max(1, floor(100 * (1 - edge) / (1 - r)) / 100).
 * => P(crash >= m) = (1 - edge) / m for every m >= 1.01, so the player's expected return is exactly (1 - edge)
 *    whatever cash-out target they choose. A crash of 1.00x happens with probability ~edge.
 */
export function crashPointFrom(serverSeed: string, clientSeed: string, houseEdgePercent: number, max: number): number {
  const hash = createHmac('sha256', serverSeed).update(clientSeed).digest('hex');
  const E = 2n ** 52n;
  const h = BigInt('0x' + hash.slice(0, 13)); // 52 bits
  const edgeBp = BigInt(Math.round(houseEdgePercent * 100)); // percent -> basis points of 10_000
  const x = (100n * (10000n - edgeBp) * E) / (10000n * (E - h)); // crash * 100, integer floor
  return Math.min(max, Math.max(1, Number(x) / 100));
}

// Multiplier curve, shared by engine and verification. t in ms since take-off.
const GROWTH = 0.00006;
export const multiplierAt = (tMs: number): number => Math.max(1, Math.floor(Math.exp(GROWTH * Math.max(0, tMs)) * 100) / 100);
export const timeToReach = (m: number): number => Math.ceil(Math.log(m) / GROWTH);
