import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { formatSignedPercent } from '../../../lib/utils/format';
import { eyebrow } from '../../../theme/theme';
import { useTrackedProducts } from '../../products/hooks/useTrackedProducts';
import { useScrapeCounts } from '../hooks/useScrapeCounts';
import { averagePriceChange } from '../kpis';

const formatCount = (value: number) => Math.round(value).toLocaleString('en-IN');

export function KpiCards() {
  const tracked = useTrackedProducts();
  const counts = useScrapeCounts();
  const change = tracked.data && averagePriceChange(tracked.data);
  const productCount = tracked.data && new Set(tracked.data.map(item => item.storeProductId)).size;
  const windowLabel = counts.data?.partial ? 'Last 24 h (at least)' : 'Last 24 h';

  return (
    <Box
      component="section"
      aria-label="Key figures"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '& > *': { py: { xs: 2.5, md: 3 }, px: { xs: 0, md: 3 } },
        '& > *:not(:first-of-type)': { borderLeft: { lg: 1 }, borderColor: { lg: 'divider' } },
        '& > *:first-of-type': { pl: { md: 0 } },
        '& > *:nth-of-type(odd)': { pr: { xs: 2, lg: 3 } },
        '& > *:nth-of-type(n+3)': { borderTop: { xs: 1, lg: 0 }, borderTopColor: 'divider' },
      }}
    >
      <Kpi
        label="Tracked options"
        query={tracked}
        value={tracked.data?.length}
        caption={
          tracked.data &&
          (tracked.data.length === 0 ? 'Nothing tracked yet' : `Across ${productCount} ${productCount === 1 ? 'product' : 'products'}`)
        }
      />
      <Kpi
        label="Successful scrapes"
        query={counts}
        value={counts.data?.successful}
        caption={counts.data && `${windowLabel} · ${counts.data.retried} after a retry`}
      />
      <Kpi label="Failed attempts" query={counts} value={counts.data?.failed} caption={windowLabel} tone={counts.data?.failed ? 'error' : undefined} />
      <Kpi
        label="Average price change"
        query={tracked}
        value={change?.pct}
        format={formatSignedPercent}
        caption={
          tracked.data &&
          (change ? `Since the previous scrape · ${change.options} ${change.options === 1 ? 'option' : 'options'}` : 'Needs two scrapes of an option')
        }
      />
    </Box>
  );
}

type KpiProps = {
  label: string;
  query: { isPending: boolean; isError: boolean; refetch: () => unknown };
  value: number | undefined;
  format?: (value: number) => string;
  caption: ReactNode;
  tone?: 'error';
};

function Kpi({ label, query, value, format = formatCount, caption, tone }: KpiProps) {
  return (
    <Box component="article" sx={{ minWidth: 0 }}>
      <Typography component="h2" sx={{ ...eyebrow, color: 'text.secondary' }}>
        {label}
      </Typography>
      {query.isPending ? (
        <>
          <Skeleton width="45%" height={44} />
          <Skeleton width="75%" />
        </>
      ) : query.isError ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Unavailable
          </Typography>
          <Button size="small" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Stack>
      ) : (
        <>
          <Typography
            component="p"
            sx={{
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 600,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              mt: 1.25,
              fontVariantNumeric: 'tabular-nums',
              color: tone === 'error' ? 'error.main' : 'text.primary',
            }}
          >
            {value === undefined ? '—' : <AnimatedNumber value={value} format={format} />}
          </Typography>
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.75 }}>
            {caption}
          </Typography>
        </>
      )}
    </Box>
  );
}

// Renders the real value straight away (never a placeholder number) and eases to new values when the data changes.
function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, format);

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.5, ease: 'easeOut' });
    return () => controls.stop();
  }, [motionValue, value, reduceMotion]);

  return <motion.span>{text}</motion.span>;
}
