import type { TrackRequest, TrackResponse, TrackedProduct } from '../../types/product';
import type { ScrapeAttempt, ScrapeStarted } from '../../types/scrape';
import { api } from './client';

export async function listTracked(): Promise<TrackedProduct[]> {
  const { data } = await api.get<{ items: TrackedProduct[] }>('/tracked');
  return data.items;
}

// Every attempt of one option, failed ones included, newest first.
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

// 202: the scrape runs in the background. 409 while another run is going, 429 within the 10-minute cooldown.
export async function scrapeTracked(id: number): Promise<ScrapeStarted> {
  const { data } = await api.post<ScrapeStarted>(`/tracked/${id}/scrape`);
  return data;
}
