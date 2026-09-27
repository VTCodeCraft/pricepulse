// PostgreSQL access: one small pool, shared by the repositories. No ORM.
// timestamptz columns come back as JS Dates (absolute instants), so the session time zone never matters.
import pg from 'pg';
import { config } from '../config.js';

// Our bigint ids are far below 2^53, so read them as numbers rather than strings.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

let pool;

// TLS follows the URL's sslmode (e.g. ?sslmode=require for Supabase); a local URL without it connects in plain text.
export function getPool() {
  if (!pool) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 3 });
  }
  return pool;
}

export const query = (text, params) => getPool().query(text, params);

// Parameter for a jsonb column.
export const json = value => (value === undefined || value === null ? null : JSON.stringify(value));

export async function closeDb() {
  await pool?.end();
  pool = undefined;
}
