// Applies pending SQL migrations to DATABASE_URL:  pnpm migrate
import { closeDb } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';

try {
  const applied = await migrate();
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'database is up to date');
} finally {
  await closeDb();
}
