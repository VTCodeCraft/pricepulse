import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Detail, DetailList } from '../../../components/common/DetailList';
import { ErrorState } from '../../../components/common/ErrorState';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDuration, formatTimestamp } from '../../../lib/utils/format';
import type { RunDetail, ScrapeRun } from '../../../types/scrape';
import { productPath } from '../../products/productInfo';
import { useRun } from '../hooks/useScrapeLog';
import {
  TRIGGER_LABELS,
  attemptDurationMs,
  attemptPrice,
  attemptStatus,
  attemptStock,
  outcomeCounts,
  triesLabel,
  type LogEntry,
} from '../scrapeLog';

type AttemptDrawerProps = { entry: LogEntry | null; open: boolean; onClose: () => void };

export function AttemptDrawer({ entry, open, onClose }: AttemptDrawerProps) {
  const titleId = useId();
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId, sx: { width: { xs: '100%', sm: 460 } } } }}
    >
      {entry && <AttemptDetails entry={entry} titleId={titleId} onClose={onClose} />}
    </Drawer>
  );
}

const monospace = { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '0.75rem' };

function AttemptDetails({ entry, titleId, onClose }: { entry: LogEntry; titleId: string; onClose: () => void }) {
  const durationMs = attemptDurationMs(entry);
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" id={titleId}>
            Attempt #{entry.id}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {entry.productName} · {entry.optionLabel}
          </Typography>
        </Box>
        <IconButton aria-label="Close details" onClick={onClose} edge="end">
          <Close />
        </IconButton>
      </Stack>

      <DetailList>
        <Detail label="Outcome">
          <StatusBadge status={attemptStatus(entry.outcome)} />
        </Detail>
        <Detail label="Finished">
          <span>
            {entry.finishedAt ? formatTimestamp(entry.finishedAt) : 'Still running'}
            {entry.finishedAt && (
              <Typography component="span" variant="caption" sx={{ display: 'block', color: 'text.secondary', ...monospace }}>
                {entry.finishedAt} (UTC)
              </Typography>
            )}
          </span>
        </Detail>
        <Detail label="Started">{formatTimestamp(entry.startedAt)}</Detail>
        <Detail label="Duration">{durationMs === null ? '—' : formatDuration(durationMs)}</Detail>
        <Detail label="Product">
          <Link component={RouterLink} to={productPath(entry.storeProductId, entry.optionId)} underline="hover">
            {entry.productName}
          </Link>
          {!entry.isTracked && (
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
              no longer tracked
            </Typography>
          )}
        </Detail>
        <Detail label="Option">{entry.optionLabel}</Detail>
        <Detail label="Attempt">#{entry.id}</Detail>
        <Detail label="Tries">{triesLabel(entry.tries)}</Detail>
        <Detail label="Price">{attemptPrice(entry)}</Detail>
        <Detail label="Stock">{attemptStock(entry)}</Detail>
        <Detail label="Layout revision">{entry.layoutRevision ?? '—'}</Detail>
        <Detail label="Error">
          {entry.errorCode ? (
            <span>
              <Box component="span" sx={monospace}>
                {entry.errorCode}
              </Box>
              {entry.errorMessage && (
                <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary' }}>
                  {entry.errorMessage}
                </Typography>
              )}
            </span>
          ) : (
            'None'
          )}
        </Detail>
      </DetailList>

      <Divider sx={{ my: 3 }} />
      <Typography variant="h3" component="h3" sx={{ mb: 1.5 }}>
        Try log
      </Typography>
      {entry.tryLog.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {entry.outcome === null ? 'No try has finished yet.' : 'No try was recorded for this attempt.'}
        </Typography>
      ) : (
        <Box component="ol" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }}>
          {entry.tryLog.map(entryTry => (
            <Box component="li" key={entryTry.tryNumber} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0 }}>
                Try {entryTry.tryNumber}
              </Typography>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2">
                  {entryTry.ok ? 'Valid data' : <Box component="span" sx={monospace}>{entryTry.code}</Box>} · {formatDuration(entryTry.ms)}
                </Typography>
                {!entryTry.ok && (
                  <Typography variant="caption" component="p" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                    {entryTry.message}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Divider sx={{ my: 3 }} />
      <RunContext runId={entry.runId} attemptId={entry.id} />
    </Box>
  );
}

const RUN_STATUS_LABELS: Record<ScrapeRun['status'], string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  abandoned: 'Abandoned',
};

// The run this attempt was part of (GET /api/runs/:id), loaded when the drawer opens.
function RunContext({ runId, attemptId }: { runId: number; attemptId: number }) {
  const run = useRun(runId);

  return (
    <section aria-label={`Run #${runId}`}>
      <Typography variant="h3" component="h3" sx={{ mb: 1.5 }}>
        Run #{runId}
      </Typography>
      {run.isPending ? (
        <Box role="status" aria-busy="true" aria-label="Loading the run">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={24} width={`${80 - i * 8}%`} />
          ))}
        </Box>
      ) : !run.data ? (
        <ErrorState title={`Unable to load run #${runId}`} message={run.error?.message} onRetry={() => run.refetch()} />
      ) : (
        <RunSummary detail={run.data} attemptId={attemptId} />
      )}
    </section>
  );
}

function RunSummary({ detail: { run, attempts }, attemptId }: { detail: RunDetail; attemptId: number }) {
  const counts = outcomeCounts(attempts);
  const durationMs = attemptDurationMs(run);
  const outcomes = [`${counts.success} success`, `${counts.retried} retried`, `${counts.failed} failed`, counts.running ? `${counts.running} running` : null];

  return (
    <>
      <DetailList>
        <Detail label="Trigger">{TRIGGER_LABELS[run.trigger]}</Detail>
        <Detail label="Status">{RUN_STATUS_LABELS[run.status]}</Detail>
        {run.errorMessage && <Detail label="Run error">{run.errorMessage}</Detail>}
        <Detail label="Started">{formatTimestamp(run.startedAt)}</Detail>
        <Detail label="Finished">{run.finishedAt ? formatTimestamp(run.finishedAt) : 'Still running'}</Detail>
        <Detail label="Duration">{durationMs === null ? '—' : formatDuration(durationMs)}</Detail>
        <Detail label="Options due">{run.productsDue}</Detail>
        <Detail label="Outcomes">{outcomes.filter(Boolean).join(' · ')}</Detail>
        {run.faultInjected && <Detail label="Test run">Faults were injected on purpose</Detail>}
      </DetailList>

      <Typography variant="subtitle2" component="h4" sx={{ mt: 2.5, mb: 1 }}>
        Attempts in this run
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.75 }}>
        {attempts.map(attempt => (
          <Box
            component="li"
            key={attempt.id}
            aria-current={attempt.id === attemptId ? 'true' : undefined}
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1,
              py: 0.75,
              borderRadius: 1.5,
              bgcolor: attempt.id === attemptId ? 'action.selected' : undefined,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {attempt.productName} · {attempt.optionLabel}
                {attempt.id === attemptId && (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
                    (this attempt)
                  </Typography>
                )}
              </Typography>
              <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                #{attempt.id} · {attemptPrice(attempt)}
              </Typography>
            </Box>
            <StatusBadge status={attemptStatus(attempt.outcome)} />
          </Box>
        ))}
      </Box>
    </>
  );
}
