import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { PageHeader } from '../../../components/common/PageHeader';
import { TimeRangeToggle } from '../../../components/common/TimeRangeToggle';
import { rangeStart, timeRange, type TimeRange } from '../../../lib/utils/timeRange';
import { useTrackedProducts } from '../../products/hooks/useTrackedProducts';
import { useScrapeLog } from '../../scraping/hooks/useScrapeLog';
import { ATTEMPT_LOG_LIMIT, NO_FILTERS, filterLog } from '../../scraping/scrapeLog';
import { attemptsOverTime, comparisonRows, reliability } from '../analytics';
import { ComparisonSection } from '../components/ComparisonSection';
import { PriceMovementSection } from '../components/PriceMovementSection';
import { ReliabilitySection } from '../components/ReliabilitySection';
import { ScrapesOverTimeSection } from '../components/ScrapesOverTimeSection';
import { StockSection } from '../components/StockSection';

// Built from queries other pages share: the tracked options, each option's scrape log (the same cache as Scrape
// Logs) and the selected option's price history. Loaded when the page opens; nothing polls.
export function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [openedAt] = useState(() => new Date()); // ranges count back from when the page opened
  const tracked = useTrackedProducts();
  const log = useScrapeLog();
  const { description } = timeRange(range);

  const header = (
    <PageHeader
      title="Analytics"
      subtitle="Price movement and scraping health across every tracked option, from the recorded scrapes."
      actions={<TimeRangeToggle value={range} onChange={setRange} />}
    />
  );

  if (tracked.isPending || log.tracked.isPending || log.isPending) {
    return (
      <>
        {header}
        <LoadingSkeleton variant="cards" label="Loading analytics" />
        <Box sx={{ mt: 3 }}>
          <LoadingSkeleton variant="chart" label="Loading charts" />
        </Box>
      </>
    );
  }
  if (!tracked.data || !log.tracked.data || log.allFailed) {
    return (
      <>
        {header}
        <ErrorState
          title="Unable to load analytics"
          message={tracked.error?.message ?? log.tracked.error?.message ?? 'No option’s attempts could be loaded.'}
          onRetry={() => {
            if (!tracked.data) tracked.refetch();
            if (!log.tracked.data) log.tracked.refetch();
            else log.retryFailed();
          }}
        />
      </>
    );
  }
  if (tracked.data.length === 0 && log.entries.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={InsightsOutlined}
          title="No analytics yet"
          description="Track a product; its prices and scrapes are analysed here."
          action={
            <Button component={RouterLink} to="/products" variant="contained">
              Track a product
            </Button>
          }
        />
      </>
    );
  }

  const items = tracked.data;
  const inRange = filterLog(log.entries, { ...NO_FILTERS, range }, openedAt);
  const notes = [
    log.failedCount > 0 && `The attempts of ${log.failedCount} ${log.failedCount === 1 ? 'option' : 'options'} could not be loaded and are left out.`,
    log.cutCount > 0 && `Only the latest ${ATTEMPT_LOG_LIMIT} attempts per option are included.`,
  ].filter(Boolean);

  return (
    <>
      {header}
      <Stack spacing={3}>
        {items.length > 0 && <PriceMovementSection items={items} range={range} start={rangeStart(range, openedAt)} />}
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
          <ReliabilitySection counts={reliability(inRange)} rangeDescription={description} note={notes.join(' ') || undefined} />
          {items.length > 0 && <StockSection items={items} />}
        </Box>
        <ScrapesOverTimeSection data={attemptsOverTime(inRange, openedAt)} rangeDescription={description} />
        {items.length > 0 && <ComparisonSection rows={comparisonRows(items, inRange)} rangeDescription={description} />}
      </Stack>
    </>
  );
}
