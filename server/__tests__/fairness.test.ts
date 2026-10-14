import { describe, expect, it } from 'vitest';
import { buildChain, crashPointFrom, multiplierAt, seedForRound, sha256, terminalHash, timeToReach } from '../fairness';

const root = 'a'.repeat(64);
describe('hash chain', () => {
  it('previous round seed is the hash of the next one (verifiable commitment)', () => {
    const L = 500;
    expect(sha256(seedForRound(root, L, 10))).toBe(seedForRound(root, L, 9));
  });
  it('rejects out-of-range rounds', () => { expect(() => seedForRound(root, 100, 101)).toThrow(); });
});
describe('checkpointed chain', () => {
  it('matches the plain chain for every round and the same terminal hash', () => {
    const L = 2500; const c = buildChain(root, L, 100);
    for (const n of [1, 2, 99, 100, 101, 1234, 2500]) expect(c.seedFor(n)).toBe(seedForRound(root, L, n));
    expect(c.terminal).toBe(terminalHash(root, L));
  });
});
describe('crash point', () => {
  it('is deterministic and >= 1.00', () => {
    const a = crashPointFrom('seed', 'client', 3, 1000);
    expect(a).toBe(crashPointFrom('seed', 'client', 3, 1000));
    expect(a).toBeGreaterThanOrEqual(1);
  });
  it('returns (1 - edge) to players at any cash-out target (20% edge)', () => {
    const N = 300000; const targets = [1.5, 2, 10, 50]; const hits = targets.map(() => 0);
    for (let i = 0; i < N; i++) { const p = crashPointFrom(sha256('s' + i), 'pub', 20, 100000); targets.forEach((m, k) => { if (p >= m) hits[k]++; }); }
    targets.forEach((m, k) => { const rtp = (m * hits[k]) / N; expect(rtp).toBeGreaterThan(0.75); expect(rtp).toBeLessThan(0.85); });
    expect((2 * hits[1]) / N).toBeGreaterThan(0.78); expect((2 * hits[1]) / N).toBeLessThan(0.82);
  });
  it('respects the cap', () => { for (let i = 0; i < 2000; i++) expect(crashPointFrom(sha256('c' + i), 'p', 3, 50)).toBeLessThanOrEqual(50); });
});
describe('multiplier curve', () => {
  it('starts at 1.00 and is monotonic', () => { expect(multiplierAt(0)).toBe(1); expect(multiplierAt(20000)).toBeGreaterThan(multiplierAt(10000)); });
  it('timeToReach is consistent with multiplierAt', () => { for (const m of [1.5, 2, 10, 100]) expect(multiplierAt(timeToReach(m))).toBeGreaterThanOrEqual(m); });
});
