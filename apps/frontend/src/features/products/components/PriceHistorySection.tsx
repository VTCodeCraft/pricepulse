import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { Section } from '../../../components/common/Section';
import { Stat } from '../../../components/common/Stat';
import { TimeRangeToggle } from '../../../components/common/TimeRangeToggle';
import { formatDateTime, formatPrice, formatRelativeTime } from '../../../lib/utils/format';
import { rangeStart, timeRange, type TimeRange } from '../../../lib/utils/timeRange';
import type { TrackedProduct } from '../../../types/product';
import type { PricePoint } from '../../../types/scrape';
import { useAttemptLog } from '../../scraping/hooks/useScrapeLog';
import { usePriceHistory } from '../hooks/usePriceHistory';
import { HISTORY_LIMIT, isHistoryCut, pointsSince, priceSummary } from '../priceHistory';
import { PriceChange } from './PriceChange';
import { PriceHistoryChart } from './PriceHistoryChart';

export function PriceHistorySection({ item }: { item: TrackedProduct }) {
  const [range, setRange] = useState<TimeRange>('30d');
  const [openedAt] = useState(() => new Date()); // ranges count back from when the page opened
  const history = usePriceHistory(item.id);

  return (
    <Section
      title="Price history"
      description={`${item.optionLabel} · successful and retried scrapes only`}
      action={<TimeRangeToggle value={range} onChange={setRange} />}
    >

      {history.isPending ? (
        <>
          <StatsSkeleton />
          <LoadingSkeleton variant="chart" label="Loading price history" />
        </>
      ) : !history.data ? (
        <ErrorState title="Unable to load the price history" message={history.error?.message} onRetry={() => history.refetch()} />
      ) : history.data.length === 0 ? (
        <NoObservations item={item} />
      ) : (
        <HistoryView item={item} points={history.data} range={range} start={rangeStart(range, openedAt)} onShowAll={() => setRange('all')} />
      )}
    </Section>
  );
}

type HistoryViewProps = {
  item: TrackedProduct;
  points: PricePoint[];
  range: TimeRange;
  start: Date | null;
  onShowAll: () => void;
};

function HistoryView({ item, points, range, start, onShowAll }: HistoryViewProps) {
  const latest = points[points.length - 1];
  const inRange = pointsSince(points, start);
  const summary = priceSummary(inRange);
  const { label, description } = timeRange(range);

  return (
    <>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, mb: 3 }}>
        <Stat label="Current price" value={formatPrice(latest.price, latest.currency)} note={`as of ${formatRelativeTime(latest.observedAt)}`} />
        <Stat label={`Lowest (${label})`} value={summary ? formatPrice(summary.lowest.price, summary.lowest.currency) : '—'} note={summary && `on ${formatDateTime(summary.lowest.observedAt)}`} />
        <Stat label={`Highest (${label})`} value={summary ? formatPrice(summary.highest.price, summary.highest.currency) : '—'} note={summary && `on ${formatDateTime(summary.highest.observedAt)}`} />
        <Stat
          label={`Average (${label})`}
          value={summary ? formatPrice(summary.average, latest.currency) : '—'}
          note={summary && `of ${summary.count} ${summary.count === 1 ? 'scrape' : 'scrapes'}`}
        />
        <Stat
          label={`Change (${label})`}
          value={summary?.changePct == null ? 'Needs two scrapes' : <PriceChange pct={summary.changePct} />}
          note={summary?.changePct != null ? `since ${formatDateTime(summary.first.observedAt)}` : null}
        />
      </Box>

      {summary ? (
        <PriceHistoryChart
          points={inRange}
          title={`Price of ${item.productName} · ${item.optionLabel}, ${description}`}
          description={`${summary.count} scrapes from ${formatDateTime(summary.first.observedAt)} (${formatPrice(summary.first.price)}) to ${formatDateTime(summary.last.observedAt)} (${formatPrice(summary.last.price)}); lowest ${formatPrice(summary.lowest.price)}, highest ${formatPrice(summary.highest.price)}.`}
        />
      ) : (
        <EmptyState
          icon={ShowChartOutlined}
          title={`No successful scrape in ${description}`}
          description={`The latest one was ${formatRelativeTime(latest.observedAt)}.`}
          action={
            <Button variant="outlined" size="small" onClick={onShowAll}>
              Show all
            </Button>
          }
        />
      )}
      {isHistoryCut(points, start) && (
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1.5 }}>
          Only the latest {HISTORY_LIMIT.toLocaleString('en-IN')} scrapes are shown; the CSV export on the Scrape Logs page has all of them.
        </Typography>
      )}
    </>
  );
}

// No validated observation yet. Failed attempts are pointed out, so this never reads as "nothing happened".
function NoObservations({ item }: { item: TrackedProduct }) {
  const attempts = useAttemptLog(item);
  const failed = attempts.data?.filter(attempt => attempt.outcome === 'failed').length ?? 0;
  return (
    <EmptyState
      icon={ShowChartOutlined}
      title="Price history will appear after the first successful scrape."
      description={failed > 0 ? `${failed} ${failed === 1 ? 'attempt has' : 'attempts have'} failed so far; the scrape history below shows why.` : undefined}
    />
  );
}

function StatsSkeleton() {
  return (
    <Box aria-hidden sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, mb: 3 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={58} />
      ))}
    </Box>
  );
}
