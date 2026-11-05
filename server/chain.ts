import { env } from './env';
import { buildChain } from './fairness';

/** Built once at boot (blocking ~2s for 2M rounds); shared by the engine and the /games/fairness route. */
export const chain = buildChain(env.FAIR_CHAIN_ROOT, env.FAIR_CHAIN_LENGTH);
