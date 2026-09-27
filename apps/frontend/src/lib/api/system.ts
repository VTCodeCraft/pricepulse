import type { Alert, Health, LayoutStatus } from '../../types/system';
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

export async function markAllAlertsRead(): Promise<number> {
  const { data } = await api.post<{ updated: number }>('/alerts/read-all');
  return data.updated;
}

export async function getLayout(): Promise<LayoutStatus> {
  const { data } = await api.get<LayoutStatus>('/layout', { params: { limit: 5 } });
  return data;
}
