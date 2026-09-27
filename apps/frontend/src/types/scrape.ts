// Shapes from apps/server/src/utils/serializers.js (runJson, runAttemptJson) and the scrape routes.

export type ScrapeOutcome = 'success' | 'retried' | 'failed';

export type ScrapeRun = {
  id: number;
  trigger: 'cron' | 'manual' | 'initial' | 'cli';
  status: 'running' | 'completed' | 'failed' | 'abandoned';
  startedAt: string;
  heartbeatAt: string;
  finishedAt: string | null;
  productsDue: number;
  success: number;
  retried: number;
  failed: number;
  errorMessage: string | null;
  faultInjected: boolean;
};

// An attempt as listed under its run (GET /api/runs/:id).
export type RunAttempt = {
  id: number;
  trackedId: number;
  storeProductId: number;
  productName: string;
  optionLabel: string;
  outcome: ScrapeOutcome | null; // null while the attempt is still running
  price: number | null;
  currency: string | null;
  stock: number | null;
  tries: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type RunDetail = { run: ScrapeRun; attempts: RunAttempt[] };

// 202 answer of POST /api/tracked/:id/scrape: the scrape runs in the background.
export type ScrapeStarted = { status: 'started'; runId: number };

// One entry of an attempt's try log (apps/server/src/scraper/retry.js).
export type TryLogEntry =
  | { tryNumber: number; ok: true; ms: number }
  | { tryNumber: number; ok: false; ms: number; code: string; message: string };

// The scrape log of one tracked option (GET /api/tracked/:id/attempts, attemptJson).
export type ScrapeAttempt = {
  id: number;
  runId: number;
  trigger: ScrapeRun['trigger'];
  startedAt: string;
  finishedAt: string | null;
  outcome: ScrapeOutcome | null; // null while the attempt is still running
  price: number | null;
  currency: string | null;
  stock: number | null;
  tries: number;
  errorCode: string | null;
  errorMessage: string | null;
  layoutRevision: number | null;
  tryLog: TryLogEntry[];
};
