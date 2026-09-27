import type { RunDetail } from '../../types/scrape';
import { api } from './client';

export async function getRun(id: number): Promise<RunDetail> {
  const { data } = await api.get<RunDetail>(`/runs/${id}`);
  return data;
}
