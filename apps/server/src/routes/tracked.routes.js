import { Router } from 'express';
import { config } from '../config.js';
import { listAttempts, listObservations } from '../db/repositories/scrape-attempts.repository.js';
import {
  claimManualScrape, countActiveOptions, countActiveTracked, getTrackedOverview, listTrackedOverview, updateTracked,
} from '../db/repositories/tracked-products.repository.js';
import { startTick } from '../scheduler/runner.js';
import { nextAligned } from '../scheduler/schedule.js';
import { refuseIfRunning, startScrapeRun } from '../services/scrape.service.js';
import { trackOptions } from '../services/tracking.service.js';
import { HttpError, notFound } from '../utils/http-error.js';
import { attemptJson, num, trackedJson } from '../utils/serializers.js';
import { intervalValue, objectBody, optionIdValue, optionIdsValue, positiveInt, queryInt, thresholdValue } from '../utils/validation.js';

export const trackedRoutes = Router();
const log = message => console.log(message);

trackedRoutes.get('/tracked', async (req, res) => {
  const rows = await listTrackedOverview({ includeInactive: req.query.includeInactive === 'true' });
  res.json({ items: rows.map(trackedJson) });
});

// One option ({ optionId } → { tracked }) or several options of the same product ({ optionIds } → { tracked: [] }).
trackedRoutes.post('/tracked', async (req, res) => {
  const body = objectBody(req.body, ['storeProductId', 'optionId', 'optionIds', 'scrapeIntervalMinutes', 'priceDropThresholdPct']);
  const storeProductId = positiveInt(body.storeProductId, 'storeProductId');
  if ((body.optionId === undefined) === (body.optionIds === undefined)) {
    throw new HttpError(400, 'invalid_request', 'Send either optionId or optionIds');
  }
  const optionIds = body.optionIds === undefined ? [optionIdValue(body.optionId)] : optionIdsValue(body.optionIds);
  const intervalMinutes = body.scrapeIntervalMinutes === undefined ? undefined : intervalValue(body.scrapeIntervalMinutes);
  const thresholdPct = body.priceDropThresholdPct === undefined ? undefined : thresholdValue(body.priceDropThresholdPct);
  // The limit counts the whole request; options that are already tracked do not add to it.
  const adding = optionIds.length - (await countActiveOptions(storeProductId, optionIds));
  if (adding > 0 && (await countActiveTracked()) + adding > config.maxTracked) {
    throw new HttpError(422, 'tracking_limit_reached', `At most ${config.maxTracked} options can be tracked at once`);
  }

  const rows = await trackOptions(storeProductId, optionIds, { intervalMinutes, thresholdPct });
  // New options get their first scrape straight away, together in one run, through the normal runner and lock.
  // If another run is busy, the next scheduled tick picks them up (they are due immediately).
  const created = rows.filter(row => row.created).map(row => row.id);
  let initialRun = null;
  if (created.length) {
    const started = await startTick({ trigger: 'initial', trackedIds: created, log });
    initialRun = started.status === 'started' ? { status: 'started', runId: started.runId } : { status: 'busy' };
  }
  const tracked = [];
  for (const row of rows) tracked.push(trackedJson(await getTrackedOverview(row.id)));
  res.status(created.length ? 201 : 200).json({ tracked: body.optionIds === undefined ? tracked[0] : tracked, initialRun });
});

trackedRoutes.get('/tracked/:id', async (req, res) => {
  res.json({ tracked: trackedJson(await findTracked(req.params.id)) });
});

trackedRoutes.patch('/tracked/:id', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  const body = objectBody(req.body, ['scrapeIntervalMinutes', 'priceDropThresholdPct', 'isActive']);
  const changes = {};
  if (body.scrapeIntervalMinutes !== undefined) {
    changes.intervalMinutes = intervalValue(body.scrapeIntervalMinutes);
    changes.nextScrapeAt = nextAligned(new Date(), changes.intervalMinutes); // re-align to the new interval
  }
  if (body.priceDropThresholdPct !== undefined) changes.thresholdPct = thresholdValue(body.priceDropThresholdPct);
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'invalid_request', 'isActive must be true or false');
    changes.isActive = body.isActive;
  }
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'invalid_request', 'Send at least one of scrapeIntervalMinutes, priceDropThresholdPct, isActive');
  }
  if (!(await updateTracked(id, changes))) throw notFound('tracked option', id);
  res.json({ tracked: trackedJson(await getTrackedOverview(id)) });
});

// Untracking keeps the row and its history; tracking the same option again re-activates it.
trackedRoutes.delete('/tracked/:id', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  if (!(await updateTracked(id, { isActive: false }))) throw notFound('tracked option', id);
  res.status(204).end();
});

// Validated observations only (success / retried), oldest first.
trackedRoutes.get('/tracked/:id/history', async (req, res) => {
  const tracked = await findTracked(req.params.id);
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 1000, fallback: 500 });
  const rows = await listObservations(tracked.id, limit);
  res.json({
    trackedId: tracked.id,
    observations: rows.map(row => ({ observedAt: row.finished_at, price: num(row.price), currency: row.currency, stock: row.stock, outcome: row.outcome })),
  });
});

// The scrape log: every attempt, failed ones included, newest first.
trackedRoutes.get('/tracked/:id/attempts', async (req, res) => {
  const tracked = await findTracked(req.params.id);
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 500, fallback: 100 });
  res.json({ trackedId: tracked.id, attempts: (await listAttempts(tracked.id, limit)).map(attemptJson) });
});

// Manual scrape of one option. Answers 202 at once; the scrape runs in the background on the shared runner.
trackedRoutes.post('/tracked/:id/scrape', async (req, res) => {
  const tracked = await findTracked(req.params.id);
  if (!tracked.is_active) throw new HttpError(409, 'not_active', 'This option is not being tracked');
  await refuseIfRunning();
  if (!(await claimManualScrape(tracked.id, config.manualScrapeCooldownMinutes))) {
    const readyAt = new Date(tracked.last_manual_scrape_at).getTime() + config.manualScrapeCooldownMinutes * 60_000;
    throw new HttpError(429, 'cooldown', `This option was scraped manually less than ${config.manualScrapeCooldownMinutes} minutes ago`, {
      retryAfterSeconds: Math.max(1, Math.ceil((readyAt - Date.now()) / 1000)),
    });
  }
  const runId = await startScrapeRun({ trigger: 'manual', trackedIds: [tracked.id] });
  res.status(202).json({ status: 'started', runId });
});

async function findTracked(idParam) {
  const id = positiveInt(idParam, 'id');
  const tracked = await getTrackedOverview(id);
  if (!tracked) throw notFound('tracked option', id);
  return tracked;
}
