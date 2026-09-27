import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { SectionCard } from '../../../components/common/SectionCard';
import { Stat } from '../../../components/common/Stat';
import { formatDateTime, formatPrice, formatRelativeTime, formatSignedPrice } from '../../../lib/utils/format';
import { timeRange, type TimeRange } from '../../../lib/utils/timeRange';
import type { TrackedProduct } from '../../../types/product';
import { PriceChange } from '../../products/components/PriceChange';
import { PriceHistoryChart } from '../../products/components/PriceHistoryChart';
import { usePriceHistory } from '../../products/hooks/usePriceHistory';
import { pointsSince, priceSummary } from '../../products/priceHistory';
import { latestChange } from '../analytics';

const optionName = (item: TrackedProduct) => `${item.productName} · ${item.optionLabel}`;

type PriceMovementSectionProps = { items: TrackedProduct[]; range: TimeRange; start: Date | null };

// One option at a time: only the selected option's history is fetched.
export function PriceMovementSection({ items, range, start }: PriceMovementSectionProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const item = items.find(candidate => candidate.id === selectedId) ?? items[0];
  const history = usePriceHistory(item.id);
  const change = latestChange(item);
  const { label, description } = timeRange(range);
  const inRange = history.data ? pointsSince(history.data, start) : [];
  const summary = priceSummary(inRange);

  return (
    <SectionCard
      title="Price movement"
      description="Latest scrape against the previous one; lowest, highest and average over the selected range."
      action={
        <TextField
          select
          size="small"
          label="Tracked option"
          value={item.id}
          onChange={event => setSelectedId(Number(event.target.value))}
          sx={{ width: { xs: '100%', sm: 320 } }}
        >
          {items.map(candidate => (
            <MenuItem key={candidate.id} value={candidate.id}>
              {optionName(candidate)}
            </MenuItem>
          ))}
        </TextField>
      }
    >
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' }, mb: 3 }}>
        <Stat label="Current price" value={change ? formatPrice(change.current, change.currency) : '—'} note={item.latest && `as of ${formatRelativeTime(item.latest.observedAt)}`} />
        <Stat label="Previous price" value={change?.previous == null ? '—' : formatPrice(change.previous, change.currency)} note={item.previous && formatDateTime(item.previous.observedAt)} />
        <Stat
          label="Change since previous"
          value={change?.amount == null ? 'Needs two scrapes' : formatSignedPrice(change.amount, change.currency)}
          note={change?.pct != null && <PriceChange pct={change.pct} />}
        />
        {history.isPending ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="rounded" height={58} />)
        ) : (
          <>
            <Stat label={`Lowest (${label})`} value={summary ? formatPrice(summary.lowest.price, summary.lowest.currency) : '—'} note={summary && formatDateTime(summary.lowest.observedAt)} />
            <Stat label={`Highest (${label})`} value={summary ? formatPrice(summary.highest.price, summary.highest.currency) : '—'} note={summary && formatDateTime(summary.highest.observedAt)} />
            <Stat label={`Average (${label})`} value={summary ? formatPrice(summary.average, summary.last.currency) : '—'} note={summary && `of ${summary.count} ${summary.count === 1 ? 'scrape' : 'scrapes'}`} />
          </>
        )}
      </Box>

      {history.isPending ? (
        <LoadingSkeleton variant="chart" label="Loading price history" />
      ) : !history.data ? (
        <ErrorState title="Unable to load the price history" message={history.error?.message} onRetry={() => history.refetch()} />
      ) : summary ? (
        <PriceHistoryChart
          points={inRange}
          title={`Price of ${optionName(item)}, ${description}`}
          description={`${summary.count} scrapes; lowest ${formatPrice(summary.lowest.price)}, highest ${formatPrice(summary.highest.price)}, latest ${formatPrice(summary.last.price)}.`}
        />
      ) : (
        <EmptyState
          icon={ShowChartOutlined}
          title={history.data.length === 0 ? 'Price history will appear after the first successful scrape.' : `No successful scrape in ${description}`}
        />
      )}
    </SectionCard>
  );
}
