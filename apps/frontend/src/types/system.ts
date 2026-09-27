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

// GET /api/alerts (alertJson). The runner raises price_drop and back_in_stock from validated observations and
// structure_changed when the store's price panel changes shape; store_app_updated is never raised.
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

// `data` of a price_drop / back_in_stock alert (apps/server/src/services/alerts.service.js).
export type ObservationAlertData = {
  storeProductId: number;
  productName: string;
  optionId: string;
  optionLabel: string;
  previousObservedAt: string;
  currency?: string;
  previousPrice?: number;
  currentPrice?: number;
  change?: number;
  changePct?: number;
  previousStock?: number;
  currentStock?: number;
};

// GET /api/layout: the store layout versions seen, structure alerts and the current page structure.
export type LayoutStatus = {
  versions: { id: number; revision: number | null; lastSeenAt: string; structureHash: string | null }[];
  structure: {
    status: 'unknown' | 'unchanged' | 'changed';
    hash: string | null;
    checkedAt: string | null;
    lastChange: Alert | null;
  };
};
