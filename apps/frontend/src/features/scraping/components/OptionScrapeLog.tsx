import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { SectionCard } from '../../../components/common/SectionCard';
import type { TrackedProduct } from '../../../types/product';
import { useAttemptLog } from '../hooks/useScrapeLog';
import { ScrapeLogTable } from './ScrapeLogTable';

// Every attempt of one tracked option, failed ones included (the product page).
export function OptionScrapeLog({ item }: { item: TrackedProduct }) {
  const log = useAttemptLog(item);

  return (
    <SectionCard
      title="Scrape history"
      description={`Every attempt for ${item.optionLabel}, failures included. Select a row for its details.`}
      action={
        <Button component={RouterLink} to={`/logs?tracked=${item.id}`} size="small">
          Open in Scrape Logs
        </Button>
      }
    >
      {log.isPending ? (
        <LoadingSkeleton variant="table" rows={4} label="Loading the scrape history" />
      ) : !log.data ? (
        <ErrorState title="Unable to load the scrape history" message={log.error?.message} onRetry={() => log.refetch()} />
      ) : log.data.length === 0 ? (
        <EmptyState icon={ReceiptLongOutlined} title="No scrape attempts yet." />
      ) : (
        <ScrapeLogTable entries={log.data} label={`Scrape history of ${item.productName} · ${item.optionLabel}`} showOption={false} pageSize={10} />
      )}
    </SectionCard>
  );
}
