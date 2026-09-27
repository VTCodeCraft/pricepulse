import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { PageHeader } from '../../../components/common/PageHeader';
import { ExportCsvButton } from '../components/ExportCsvButton';
import { LogFilters } from '../components/LogFilters';
import { ScrapeLogTable } from '../components/ScrapeLogTable';
import { useScrapeLog } from '../hooks/useScrapeLog';
import { ATTEMPT_LOG_LIMIT, NO_FILTERS, filterLog } from '../scrapeLog';

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function LogsPage() {
  const [params] = useSearchParams();
  const trackedParam = Number(params.get('tracked'));
  // ?tracked=<id> (from a product page) opens the log filtered to that option.
  const [filters, setFilters] = useState(() => ({ ...NO_FILTERS, trackedId: Number.isInteger(trackedParam) && trackedParam > 0 ? trackedParam : null }));
  const [openedAt] = useState(() => new Date()); // time ranges count back from when the page opened
  const log = useScrapeLog();

  const options = log.tracked.data ?? [];
  // An id that is not one of the options (a hand-edited link) is ignored rather than matching nothing.
  const applied = filters.trackedId === null || options.some(option => option.id === filters.trackedId) ? filters : { ...filters, trackedId: null };
  const shown = filterLog(log.entries, applied, openedAt);

  return (
    <>
      <PageHeader
        title="Scrape Logs"
        subtitle={`Every scrape attempt of every option, failures included. Times are in your time zone (${timeZone}).`}
        actions={<ExportCsvButton />}
      />
      <Card sx={{ p: 2.5 }}>
        {log.tracked.isPending || log.isPending ? (
          <LoadingSkeleton variant="table" label="Loading the scrape log" />
        ) : !log.tracked.data ? (
          <ErrorState title="Unable to load the scrape log" message={log.tracked.error?.message} onRetry={() => log.tracked.refetch()} />
        ) : log.allFailed ? (
          <ErrorState title="Unable to load the scrape log" message="No option's attempts could be loaded." onRetry={() => log.retryFailed()} />
        ) : log.entries.length === 0 ? (
          <EmptyState
            icon={ReceiptLongOutlined}
            title="No scrape attempts yet."
            description={options.length === 0 ? 'Track a product; its first scrape appears here.' : 'Attempts appear here as the scheduled scrapes run.'}
          />
        ) : (
          <Stack spacing={2}>
            <LogFilters filters={applied} onChange={setFilters} options={options} />
            {log.failedCount > 0 && (
              <Alert
                severity="warning"
                action={
                  <Button color="inherit" size="small" onClick={() => log.retryFailed()}>
                    Try again
                  </Button>
                }
              >
                The attempts of {log.failedCount} {log.failedCount === 1 ? 'option' : 'options'} could not be loaded and are missing below.
              </Alert>
            )}
            <Typography variant="body2" role="status" sx={{ color: 'text.secondary' }}>
              {shown.length === log.entries.length ? `${log.entries.length} attempts` : `${shown.length} of ${log.entries.length} attempts`}
              {log.cutCount > 0 && ` · the latest ${ATTEMPT_LOG_LIMIT} per option; Export CSV has every attempt`}
              {shown.length > 0 && ' · select a row for its details'}
            </Typography>
            {shown.length === 0 ? (
              <EmptyState
                icon={FilterAltOffOutlined}
                title="No attempts match these filters"
                action={
                  <Button variant="outlined" size="small" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <ScrapeLogTable entries={shown} label="Scrape attempts" />
            )}
          </Stack>
        )}
      </Card>
    </>
  );
}
