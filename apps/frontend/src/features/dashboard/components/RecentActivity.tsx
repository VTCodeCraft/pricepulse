import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { Section } from '../../../components/common/Section';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatRelativeTime, formatTimestamp } from '../../../lib/utils/format';
import { monospace } from '../../../theme/theme';
import { attemptPrice, attemptStatus, attemptTime } from '../../scraping/scrapeLog';
import { useRecentAttempts } from '../hooks/useScrapeCounts';

// The last few scrape attempts of the tracked options, failures included.
export function RecentActivity() {
  const recent = useRecentAttempts(6);

  return (
    <Section
      title="Recent scrape activity"
      description="Newest attempts across the tracked options."
      action={
        <Link component={RouterLink} to="/logs" sx={{ fontSize: '0.8125rem', color: 'primary.dark', fontWeight: 500 }}>
          Open Scrape Logs →
        </Link>
      }
    >
      {recent.isPending ? (
        Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={40} />)
      ) : recent.entries.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {recent.isError ? 'The scrape log could not be loaded.' : 'No scrape attempts yet.'}
        </Typography>
      ) : (
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {recent.entries.map(entry => (
            <Box
              component="li"
              key={entry.id}
              sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', alignItems: 'center', columnGap: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tooltip title={formatTimestamp(attemptTime(entry))}>
                <Typography component="span" sx={{ ...monospace, color: 'text.secondary', minWidth: 72 }}>
                  {formatRelativeTime(attemptTime(entry))}
                </Typography>
              </Tooltip>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {entry.productName}
                </Typography>
                <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary' }}>
                  {entry.optionLabel} · {attemptPrice(entry)}
                </Typography>
              </Box>
              <StatusBadge status={attemptStatus(entry.outcome)} />
            </Box>
          ))}
        </Box>
      )}
    </Section>
  );
}
