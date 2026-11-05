# Aviator – production setup

## What's in here
- `server.ts` + `server/` – real backend (the old `server.ts` was a stub): auth, wallet, game engine, provably-fair, payments, admin API, chat, health checks.
- `src/` – your frontend with fixes (duplicate `BetUsers/` removed, layout/metadata, socket bugs, history URL).
- Root configs: `package.json`, `tsconfig.server.json`, `eslint.config.mjs`, `next.config.ts`, `Dockerfile`, `docker-compose.yml`, `.env.example`.

## Quick start (local, copy-paste)
```
docker compose up -d mongo redis     # wait ~15s for the replica set
npm install
npm test && npm run typecheck        # please run these first and send me any errors
npm run create-admin                 # admin@example.com / ChangeMe-Admin-12345 (from .env) - change it
npm run dev                          # http://localhost:3000   admin panel: /admin
```
The included `.env` is for local development only (it has throwaway secrets).

## First run (details)
1. `cp .env.example .env` and fill it in (`openssl rand -base64 48` for JWT_SECRET, `openssl rand -hex 32` for FAIR_CHAIN_ROOT).
2. `docker compose up -d mongo redis` (Mongo runs as a single-node replica set – required for transactions).
   Use `MONGODB_URI=mongodb://localhost:27017/aviator?replicaSet=rs0` if running the app outside Docker.
3. `npm install && npm run test && npm run typecheck`
4. `npm run create-admin` (uses ADMIN_EMAIL / ADMIN_PASSWORD, then delete them from `.env`)
5. `npm run dev`

## Deploy
`docker compose up -d --build` behind nginx/Caddy/Cloudflare with TLS and WebSocket upgrade enabled.
Run **exactly one app instance** – the engine takes a Redis lock and a second instance refuses to start.
`/healthz` = liveness, `/readyz` = DB ready + current round phase.

## Money rules enforced by the server
Balances are integer minor units; every change is a Mongo transaction + an append-only ledger row (`transactions`);
bets are debited atomically (never negative); one bet per slot per round (unique index); payouts are idempotent;
cash-out multiplier comes from the **server clock** only; rounds interrupted by a crash/restart are voided and refunded on boot.

## Fairness
Hash chain (`seed(n-1) = SHA256(seed(n))`), `crash = floor(100·(1−edge)/(1−r))/100` with r from HMAC-SHA256(seed, clientSeed).
Players' expected return is (1 − `HOUSE_EDGE_PERCENT`%) at any cash-out target (verified by the unit test).
Publish `/api/v1/games/fairness` (terminal hash + client seed) before launch. Back up `FAIR_CHAIN_ROOT` offline; never change it with existing rounds.
At `FAIR_CHAIN_LENGTH` rounds the chain is exhausted – rotate it (1M rounds is roughly 7 months at ~20s per round – plan the rotation before launch).

## Not done / your decisions
- Payments: only Razorpay (what your modal uses; INR). For Kenya you need M-Pesa (Daraja) – a second provider in `server/routes/payments.ts`.
- Withdrawal "approve" marks it approved; actual payout is manual/off-platform until you wire a payout API.
- Tokens still live in `localStorage` (existing design). Moving to httpOnly cookies + refresh tokens is the next hardening step.
- CSP header not set (needs testing with Unity WebGL + Razorpay checkout).
- No KYC, age verification, self-exclusion or deposit limits – regulators normally require these (see below).
- Fairness `clientSeed` is a fixed public value; a stronger scheme mixes in an unpredictable public value per round.
