import type { Alert, Health } from '../../types/system';
import { api } from './client';

export async function getHealth(): Promise<Health> {
  const { data } = await api.get<Health>('/health');
  return data;
}

// Newest first, at most `limit` (the endpoint allows 200).
export async function listAlerts(limit: number): Promise<Alert[]> {
  const { data } = await api.get<{ alerts: Alert[] }>('/alerts', { params: { limit } });
  return data.alerts;
}
