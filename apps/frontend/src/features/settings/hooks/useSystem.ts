import { useQuery } from '@tanstack/react-query';
import { getHealth, listAlerts } from '../../../lib/api/system';
import { queryKeys } from '../../../lib/query/keys';

// Asked when Settings opens and on "Check again"; a failure is reported at once rather than retried.
export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: getHealth, retry: false });
}

export function useAlerts() {
  return useQuery({ queryKey: queryKeys.alerts, queryFn: () => listAlerts(50) });
}
