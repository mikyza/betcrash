import pino from 'pino';
import { env, isProd } from './env';

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  redact: { paths: ['req.headers.authorization', 'headers.authorization', 'password', '*.password', 'newPassword', 'currentPassword', 'passwordHash', '*.passwordHash', 'token', '*.token', 'accessToken'], censor: '[redacted]' },
  transport: isProd ? undefined : { target: 'pino-pretty' },
  base: { env: env.NODE_ENV },
});
