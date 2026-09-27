// Starting a scrape run from an HTTP request. The database lock allows one run at a time; while a run is going,
// the request is refused with 409 and the running run's id.
import { getRunningRun } from '../db/repositories/scrape-runs.repository.js';
import { startTick } from '../scheduler/runner.js';
import { HttpError } from '../utils/http-error.js';

const log = message => console.log(message);

export async function refuseIfRunning() {
  const running = await getRunningRun();
  if (running) {
    throw new HttpError(409, 'run_in_progress', 'A scrape run is already in progress', { runningRunId: running.id, startedAt: running.started_at });
  }
}

// Starts the run in the background and returns its id. If another run took the lock first, answers 409.
export async function startScrapeRun(options) {
  const started = await startTick({ ...options, log });
  if (started.status === 'busy') await refuseIfRunning();
  return started.runId;
}
