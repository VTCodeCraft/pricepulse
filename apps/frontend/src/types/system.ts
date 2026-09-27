import type { ScrapeRun } from './scrape';

// GET /api/health (apps/server/src/routes/health.routes.js). Always 200 while the process is up; the database state
// is reported inside.
export type Health = {
  ok: true;
  time: string;
  uptimeSeconds: number;
  database: { status: 'ok'; migrations: string[] } | { status: 'unavailable' };
  lastRun?: ScrapeRun | null; // only when the database answered; null before the first run
};

// GET /api/alerts (alertJson). The backend can store alerts, but nothing creates them yet.
export type Alert = {
  id: number;
  type: 'price_drop' | 'back_in_stock' | 'structure_changed' | 'store_app_updated';
  severity: 'info' | 'warning';
  trackedId: number | null;
  attemptId: number | null;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
  emailStatus: 'not_configured' | 'pending' | 'sent' | 'failed';
};
