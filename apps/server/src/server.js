// Starts the API. Pending migrations are applied first; they are idempotent and each runs in a transaction.
// If the database is unreachable the server still starts, and /api/health reports the database as unavailable.
import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/client.js';
import { migrate } from './db/migrate.js';

const PORT = Number(process.env.PORT) || 3000;

if (config.databaseUrl) {
  try {
    const applied = await migrate();
    console.log(applied.length ? `migrations applied: ${applied.join(', ')}` : 'database schema is up to date');
  } catch (error) {
    console.error(`migrations failed: ${error.message}`);
  }
} else {
  console.warn('DATABASE_URL is not set: only /api/health will work');
}

const server = createApp().listen(PORT, () => console.log(`server listening on :${PORT}`));

// Render sends SIGTERM before replacing the instance. A run cut off here is closed later by the stale-run reaper.
process.on('SIGTERM', () => {
  server.close(() => closeDb().finally(() => process.exit(0)));
});
