// Applies pending SQL migrations to DATABASE_URL:  pnpm migrate
import { closeDb, migrate } from './db.js';

try {
  const applied = await migrate();
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'database is up to date');
} finally {
  await closeDb();
}
