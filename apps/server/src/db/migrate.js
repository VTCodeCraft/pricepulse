// Schema migrations: db/migrations/*.sql, applied on server start and by `pnpm migrate`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPool, query } from './client.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'db', 'migrations');

// Applies db/migrations/*.sql in filename order, each once and in its own transaction.
export async function migrate(dir = MIGRATIONS_DIR) {
  await query('create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())');
  const applied = new Set((await query('select filename from schema_migrations')).rows.map(row => row.filename));
  const pending = readdirSync(dir).filter(file => file.endsWith('.sql')).sort().filter(file => !applied.has(file));
  for (const file of pending) {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('insert into schema_migrations (filename) values ($1)', [file]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw new Error(`migration ${file} failed: ${error.message}`, { cause: error });
    } finally {
      client.release();
    }
  }
  return pending;
}

export async function appliedMigrations() {
  return (await query('select filename from schema_migrations order by filename')).rows.map(row => row.filename);
}
