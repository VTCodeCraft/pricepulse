import type { TrackRequest, TrackResponse, TrackedProduct } from '../../types/product';
import type { PriceHistory, ScrapeAttempt, ScrapeStarted } from '../../types/scrape';
import { api } from './client';

// Active options only, unless `includeInactive`: untracked options keep their history and scrape log.
export async function listTracked({ includeInactive = false } = {}): Promise<TrackedProduct[]> {
  const { data } = await api.get<{ items: TrackedProduct[] }>('/tracked', { params: includeInactive ? { includeInactive } : undefined });
  return data.items;
}

// Validated observations only (success / retried), the most recent `limit` of them (at most 1000), oldest first.
export async function getHistory(id: number, limit: number): Promise<PriceHistory> {
  const { data } = await api.get<PriceHistory>(`/tracked/${id}/history`, { params: { limit } });
  return data;
}

// Every attempt of one option, failed and running ones included, newest first (at most 500).
export async function listAttempts(id: number, limit: number): Promise<ScrapeAttempt[]> {
  const { data } = await api.get<{ attempts: ScrapeAttempt[] }>(`/tracked/${id}/attempts`, { params: { limit } });
  return data.attempts;
}

// Checks the option against the store, then starts tracking it. 422 `tracking_limit_reached` / `option_not_found`.
export async function track(request: TrackRequest): Promise<TrackResponse> {
  const { data } = await api.post<TrackResponse>('/tracked', request);
  return data;
}

// Untracking keeps the history; tracking the same option again re-activates it.
export async function untrack(id: number): Promise<void> {
  await api.delete(`/tracked/${id}`);
}

// Changing the interval re-aligns the next scrape on the server. 400 for an interval outside the allowed list.
export async function updateTracked(id: number, changes: { scrapeIntervalMinutes: number }): Promise<TrackedProduct> {
  const { data } = await api.patch<{ tracked: TrackedProduct }>(`/tracked/${id}`, changes);
  return data.tracked;
}

// 202: the scrape runs in the background. 409 while another run is going, 429 within the 10-minute cooldown.
export async function scrapeTracked(id: number): Promise<ScrapeStarted> {
  const { data } = await api.post<ScrapeStarted>(`/tracked/${id}/scrape`);
  return data;
}
