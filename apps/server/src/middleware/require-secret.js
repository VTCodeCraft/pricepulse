// Guards the cron and admin endpoints: `Authorization: Bearer <CRON_SECRET>`, compared in constant time.
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

export function requireSecret(req, _res, next) {
  if (!config.cronSecret) throw new HttpError(503, 'not_configured', 'CRON_SECRET is not set on the server');
  const given = Buffer.from(req.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${config.cronSecret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, 'unauthorized', 'Missing or wrong bearer token');
  }
  next();
}
