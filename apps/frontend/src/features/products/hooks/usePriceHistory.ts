import { useQuery } from '@tanstack/react-query';
import { getHistory } from '../../../lib/api/tracked';
import { queryKeys } from '../../../lib/query/keys';
import type { PriceHistory } from '../../../types/scrape';
import { HISTORY_LIMIT } from '../priceHistory';

const observations = (history: PriceHistory) => history.observations;

// One request per option; the page applies the time ranges to it (the endpoint has no date filter).
export function usePriceHistory(trackedId: number) {
  return useQuery({ queryKey: queryKeys.history(trackedId), queryFn: () => getHistory(trackedId, HISTORY_LIMIT), select: observations });
}
