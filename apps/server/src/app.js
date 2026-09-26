// The Express app: CORS for the frontend, JSON bodies, the /api routes, and one place that turns every error into a
// JSON response. Stack traces, SQL and connection details stay in the server log.
import express from 'express';
import { config } from './config.js';
import { ScrapeError } from './retry.js';
import { HttpError, router } from './routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(config.corsOrigins));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', router);
  app.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'No such endpoint')));
  app.use((error, req, res, _next) => {
    const { status, body } = toErrorResponse(error);
    // HttpErrors are deliberate answers; anything else (store, database, bugs) is worth a log line.
    if (!(error instanceof HttpError)) console.error(`${req.method} ${req.path} → ${status}: ${error.message}`);
    res.status(status).json(body);
  });
  return app;
}

// Only listed origins get CORS headers; the cron endpoints are called server-to-server and need none.
function cors(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '600');
        return res.status(204).end();
      }
    }
    next();
  };
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) return reply(error.status, error.code, error.message, error.details);
  if (error.type === 'entity.parse.failed') return reply(400, 'invalid_json', 'The request body is not valid JSON');
  if (error.type === 'entity.too.large') return reply(413, 'too_large', 'The request body is too large');
  if (error instanceof ScrapeError) {
    if (error.code === 'product_not_found') return reply(404, 'product_not_found', error.message);
    if (error.code === 'option_not_found') return reply(422, 'option_not_found', error.message);
    return reply(502, 'store_unavailable', 'The store did not answer properly; try again shortly');
  }
  if (isDatabaseUnavailable(error)) return reply(503, 'database_unavailable', 'The database is not reachable right now');
  // Constraint violations should be caught by validation first; the database stays the last line of defence.
  if (error.code === '23505') return reply(409, 'conflict', 'That already exists');
  if (/^23/.test(error.code ?? '')) return reply(422, 'invalid_value', 'The database rejected that value');
  return reply(500, 'internal_error', 'Something went wrong on the server');
}

function reply(status, code, message, details) {
  return { status, body: { error: { code, message, ...(details ? { details } : {}) } } };
}

// Network errors, PostgreSQL "connection exception" (08xxx), shutdown (57P0x) and too-many-connections (53300).
function isDatabaseUnavailable(error) {
  return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(error.code)
    || /^(08|57P0|53300)/.test(error.code ?? '')
    || error.message === 'DATABASE_URL is not set'
    || /Connection terminated|timeout exceeded when trying to connect/i.test(error.message ?? '');
}
