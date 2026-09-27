import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import { formatDistanceToNowStrict, isPast } from 'date-fns';
import { Detail, DetailList } from '../../../components/common/DetailList';
import { ErrorState } from '../../../components/common/ErrorState';
import { SectionCard } from '../../../components/common/SectionCard';
import { formatDateTime, formatRelativeTime } from '../../../lib/utils/format';
import { useTrackedProducts } from '../../products/hooks/useTrackedProducts';
import { RUN_STATUS_LABELS, TRIGGER_LABELS } from '../../scraping/scrapeLog';
import { useHealth } from '../hooks/useSystem';

// Read-only: the values the API reports. The schedule lives on the server and is not changed from here.
export function ScrapingSection() {
  const tracked = useTrackedProducts();
  const health = useHealth();
  const items = tracked.data ?? [];
  const intervals = [...new Set(items.map(item => item.scrapeIntervalMinutes))].sort((a, b) => a - b);
  const next = items.map(item => item.nextScrapeAt).sort()[0];
  const lastRun = health.data?.lastRun;

  return (
    <SectionCard title="Scraping" description="Read from the server, where the schedule is set. Nothing here changes it.">
      {!tracked.isPending && !tracked.data ? (
        <ErrorState title="Unable to load the scraping settings" message={tracked.error?.message} onRetry={() => tracked.refetch()} />
      ) : (
        <DetailList>
          <Detail label="Tracked options">{tracked.data ? `${items.length} active` : <Skeleton width={80} />}</Detail>
          <Detail label="Scrape interval">
            {!tracked.data ? <Skeleton width={120} /> : intervals.length === 0 ? '—' : `Every ${intervals.join(' or ')} minutes, set per option`}
          </Detail>
          <Detail label="Next scheduled scrape">
            {!tracked.data ? (
              <Skeleton width={120} />
            ) : next ? (
              <Tooltip title={formatDateTime(next)}>
                <span>{isPast(new Date(next)) ? 'Due now' : `In ${formatDistanceToNowStrict(new Date(next))}`}</span>
              </Tooltip>
            ) : (
              '—'
            )}
          </Detail>
          <Detail label="Last run">
            {health.isPending ? (
              <Skeleton width={160} />
            ) : lastRun ? (
              <Tooltip title={formatDateTime(lastRun.finishedAt ?? lastRun.startedAt)}>
                <span>
                  #{lastRun.id} · {TRIGGER_LABELS[lastRun.trigger]} · {RUN_STATUS_LABELS[lastRun.status]} ·{' '}
                  {formatRelativeTime(lastRun.finishedAt ?? lastRun.startedAt)}
                </span>
              </Tooltip>
            ) : (
              '—'
            )}
          </Detail>
        </DetailList>
      )}
    </SectionCard>
  );
}
