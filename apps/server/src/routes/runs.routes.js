import { Router } from 'express';
import { getRun, listRunAttempts, listRuns } from '../db/repositories/scrape-runs.repository.js';
import { requireSecret } from '../middleware/require-secret.js';
import { refuseIfRunning, startScrapeRun } from '../services/scrape.service.js';
import { notFound } from '../utils/http-error.js';
import { runAttemptJson, runJson } from '../utils/serializers.js';
import { objectBody, positiveInt, queryInt } from '../utils/validation.js';

export const runsRoutes = Router();

// Called by the external cron. Scrapes the options that are due; { "force": true } scrapes every active option.
runsRoutes.post('/scrape/run', requireSecret, async (req, res) => {
  const force = objectBody(req.body ?? {}, ['force']).force === true;
  await refuseIfRunning();
  const runId = await startScrapeRun({ trigger: force ? 'manual' : 'cron', force });
  res.status(202).json({ status: 'started', runId });
});

runsRoutes.get('/runs', async (req, res) => {
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 100, fallback: 20 });
  res.json({ runs: (await listRuns(limit)).map(runJson) });
});

runsRoutes.get('/runs/:id', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  const run = await getRun(id);
  if (!run) throw notFound('run', id);
  const attempts = await listRunAttempts(id);
  res.json({ run: runJson(run), attempts: attempts.map(runAttemptJson) });
});
