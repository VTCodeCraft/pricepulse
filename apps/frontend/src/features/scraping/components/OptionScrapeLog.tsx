import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import type { TrackedProduct } from '../../../types/product';
import { useAttemptLog } from '../hooks/useScrapeLog';
import { ScrapeLogTable } from './ScrapeLogTable';

// Every attempt of one tracked option, failed ones included (the product page).
export function OptionScrapeLog({ item }: { item: TrackedProduct }) {
  const headingId = useId();
  const log = useAttemptLog(item);

  return (
    <Card component="section" aria-labelledby={headingId} sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography variant="h2" id={headingId}>
            Scrape history
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Every attempt for {item.optionLabel}, failures included. Select a row for its details.
          </Typography>
        </Box>
        <Button component={RouterLink} to={`/logs?tracked=${item.id}`} size="small" sx={{ flexShrink: 0 }}>
          Open in Scrape Logs
        </Button>
      </Stack>
      {log.isPending ? (
        <LoadingSkeleton variant="table" rows={4} label="Loading the scrape history" />
      ) : !log.data ? (
        <ErrorState title="Unable to load the scrape history" message={log.error?.message} onRetry={() => log.refetch()} />
      ) : log.data.length === 0 ? (
        <EmptyState icon={ReceiptLongOutlined} title="No scrape attempts yet." />
      ) : (
        <ScrapeLogTable entries={log.data} label={`Scrape history of ${item.productName} · ${item.optionLabel}`} showOption={false} pageSize={10} />
      )}
    </Card>
  );
}
