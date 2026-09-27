import { Router } from 'express';
import { appliedMigrations } from '../db/migrate.js';
import { listRuns } from '../db/repositories/scrape-runs.repository.js';
import { runJson } from '../utils/serializers.js';

export const healthRoutes = Router();

// Always 200 while the process is up (Render uses it to decide a deploy is live); the database state is reported inside.
healthRoutes.get('/health', async (_req, res) => {
  const body = { ok: true, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) };
  try {
    const [migrations, [lastRun]] = await Promise.all([appliedMigrations(), listRuns(1)]);
    body.database = { status: 'ok', migrations };
    body.lastRun = lastRun ? runJson(lastRun) : null;
  } catch {
    body.database = { status: 'unavailable' };
  }
  res.json(body);
});
