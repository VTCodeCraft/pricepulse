import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getHealth, getLayout, listAlerts, markAllAlertsRead } from '../../../lib/api/system';
import { queryKeys } from '../../../lib/query/keys';

// Asked when Settings opens and on "Check again"; a failure is reported at once rather than retried.
export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: getHealth, retry: false });
}

export function useAlerts() {
  return useQuery({ queryKey: queryKeys.alerts, queryFn: () => listAlerts(50) });
}

export function useMarkAllAlertsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAlertsRead,
    onError: error => toast.error(error.message),
    // Reading a structure alert also acknowledges the change shown in the layout status.
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.alerts }), queryClient.invalidateQueries({ queryKey: queryKeys.layout })]),
  });
}

export function useLayoutStatus() {
  return useQuery({ queryKey: queryKeys.layout, queryFn: getLayout });
}
