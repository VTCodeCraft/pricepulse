import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { formatDistanceToNowStrict, isPast } from 'date-fns';
import { Detail, DetailList } from '../../../components/common/DetailList';
import { ErrorState } from '../../../components/common/ErrorState';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Section } from '../../../components/common/Section';
import { formatDateTime, formatRelativeTime } from '../../../lib/utils/format';
import { useTrackedProducts } from '../../products/hooks/useTrackedProducts';
import { RUN_STATUS_LABELS, TRIGGER_LABELS } from '../../scraping/scrapeLog';
import { intervalLabel } from '../../products/scrapeIntervals';
import { useHealth, useLayoutStatus } from '../hooks/useSystem';

// Read-only: the values the API reports. The schedule lives on the server; each option's interval is changed on its page.
export function ScrapingSection() {
  const tracked = useTrackedProducts();
  const health = useHealth();
  const layout = useLayoutStatus();
  const items = tracked.data ?? [];
  const intervals = [...new Set(items.map(item => item.scrapeIntervalMinutes))].sort((a, b) => a - b);
  const next = items.map(item => item.nextScrapeAt).sort()[0];
  const lastRun = health.data?.lastRun;

  return (
    <Section layout="aside" title="Scraping" description="Read from the server, where the schedule is kept. Change an option's interval on its product page.">
      {!tracked.isPending && !tracked.data ? (
        <ErrorState title="Unable to load the scraping settings" message={tracked.error?.message} onRetry={() => tracked.refetch()} />
      ) : (
        <DetailList>
          <Detail label="Tracked options">{tracked.data ? `${items.length} active` : <Skeleton width={80} />}</Detail>
          <Detail label="Scrape interval">
            {!tracked.data ? <Skeleton width={120} /> : intervals.length === 0 ? '—' : `${intervals.map(intervalLabel).join(', ')} · set per option`}
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
          <Detail label="Store page structure">
            <PageStructure layout={layout} />
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
    </Section>
  );
}

// The fingerprint of the store's price panel from the latest successful scrape, and whether it changed since the
// last acknowledged state (an unread structure alert).
function PageStructure({ layout }: { layout: ReturnType<typeof useLayoutStatus> }) {
  if (layout.isPending) return <Skeleton width={160} />;
  if (!layout.data) return <>Could not be loaded</>;
  const { structure, versions } = layout.data;
  if (structure.status === 'unknown' || !structure.checkedAt) return <>Not checked yet: the next successful scrape records it</>;
  const revision = versions[0]?.revision;
  return (
    <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
      <StatusBadge status={structure.status === 'changed' ? 'structureChanged' : 'structureUnchanged'} />
      <Tooltip title={formatDateTime(structure.checkedAt)}>
        <span>
          checked {formatRelativeTime(structure.checkedAt)}
          {revision != null && ` · layout revision ${revision}`}
        </span>
      </Tooltip>
    </Stack>
  );
}
