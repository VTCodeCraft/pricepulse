import Box from '@mui/material/Box';
import { SectionCard } from '../../../components/common/SectionCard';
import { Stat } from '../../../components/common/Stat';
import { reliability } from '../analytics';

type ReliabilitySectionProps = { counts: ReturnType<typeof reliability>; rangeDescription: string; note?: string };

// Outcomes as the backend recorded them on each attempt.
export function ReliabilitySection({ counts, rangeDescription, note }: ReliabilitySectionProps) {
  const { successful, retried, failed, running, finished, successRate } = counts;
  return (
    <SectionCard title="Scrape reliability" description={`Finished attempts in ${rangeDescription}, untracked options included.${note ? ` ${note}` : ''}`}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Stat label="Successful" value={successful} note="Returned a valid price" />
        <Stat label="Retried" value={retried} note="Of the successful, needed a retry" />
        <Stat label="Failed" value={failed} note="No valid price" />
        <Stat
          label="Success rate"
          value={successRate === null ? '—' : `${successRate.toFixed(1)}%`}
          note={finished === 0 ? 'No finished attempts' : `${successful} of ${finished} returned a valid price${running ? ` · ${running} running` : ''}`}
        />
      </Box>
    </SectionCard>
  );
}
