import { describe, expect, it } from 'vitest';
import { toErrorResponse } from '../src/app.js';
import { ScrapeError } from '../src/retry.js';
import { HttpError } from '../src/routes.js';

const codeOf = error => {
  const { status, body } = toErrorResponse(error);
  return `${status} ${body.error.code}`;
};

describe('toErrorResponse', () => {
  it('passes deliberate HTTP errors through with their details', () => {
    expect(toErrorResponse(new HttpError(429, 'cooldown', 'wait', { retryAfterSeconds: 60 }))).toEqual({
      status: 429,
      body: { error: { code: 'cooldown', message: 'wait', details: { retryAfterSeconds: 60 } } },
    });
  });

  it.each([
    [new ScrapeError('product_not_found', 'x'), '404 product_not_found'],
    [new ScrapeError('option_not_found', 'x'), '422 option_not_found'],
    [new ScrapeError('store_http_error', 'x'), '502 store_unavailable'],
    [new ScrapeError('timeout', 'x'), '502 store_unavailable'],
    [Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }), '503 database_unavailable'],
    [Object.assign(new Error('terminating connection'), { code: '57P01' }), '503 database_unavailable'],
    [Object.assign(new Error('connection failure'), { code: '08006' }), '503 database_unavailable'],
    [new Error('DATABASE_URL is not set'), '503 database_unavailable'],
    [Object.assign(new Error('duplicate key'), { code: '23505' }), '409 conflict'],
    [Object.assign(new Error('violates check constraint'), { code: '23514' }), '422 invalid_value'],
    [Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' }), '400 invalid_json'],
  ])('%s → %s', (error, expected) => {
    expect(codeOf(error)).toBe(expected);
  });

  it('never leaks internal messages for unexpected errors', () => {
    const { status, body } = toErrorResponse(new Error('password authentication failed for user "postgres" at secret-host'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/password|secret-host/);
  });
});
