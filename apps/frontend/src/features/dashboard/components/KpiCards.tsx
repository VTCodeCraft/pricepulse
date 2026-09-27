import type { SvgIconComponent } from '@mui/icons-material';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { formatSignedPercent } from '../../../lib/utils/format';
import { useTrackedProducts } from '../../products/hooks/useTrackedProducts';
import { useScrapeCounts } from '../hooks/useScrapeCounts';
import { averagePriceChange } from '../kpis';

const formatCount = (value: number) => Math.round(value).toLocaleString('en-IN');

export function KpiCards() {
  const tracked = useTrackedProducts();
  const counts = useScrapeCounts();
  const change = tracked.data && averagePriceChange(tracked.data);
  const productCount = tracked.data && new Set(tracked.data.map(item => item.storeProductId)).size;
  const windowLabel = counts.data?.partial ? 'Last 24 hours (at least)' : 'Last 24 hours';

  return (
    <Box
      component="section"
      aria-label="Key figures"
      sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <KpiCard
        icon={Inventory2Outlined}
        label="Tracked products"
        query={tracked}
        value={tracked.data?.length}
        caption={
          tracked.data &&
          (tracked.data.length === 0
            ? 'Nothing tracked yet'
            : `${tracked.data.length === 1 ? 'Option' : 'Options'} across ${productCount} ${productCount === 1 ? 'product' : 'products'}`)
        }
      />
      <KpiCard
        icon={CheckCircleOutlineOutlined}
        label="Successful scrapes"
        query={counts}
        value={counts.data?.successful}
        caption={counts.data && `${windowLabel} · ${counts.data.retried} after a retry`}
      />
      <KpiCard
        icon={ErrorOutlineOutlined}
        label="Failed attempts"
        query={counts}
        value={counts.data?.failed}
        caption={windowLabel}
      />
      <KpiCard
        icon={ShowChartOutlined}
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

type KpiCardProps = {
  icon: SvgIconComponent;
  label: string;
  query: { isPending: boolean; isError: boolean; refetch: () => unknown };
  value: number | undefined;
  format?: (value: number) => string;
  caption: ReactNode;
};

function KpiCard({ icon: Icon, label, query, value, format = formatCount, caption }: KpiCardProps) {
  return (
    <Card component="article" sx={{ p: 2.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="body2" component="h2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {label}
        </Typography>
        <Box
          sx={theme => ({
            width: 32,
            height: 32,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.1)`,
          })}
        >
          <Icon fontSize="small" />
        </Box>
      </Stack>

      {query.isPending ? (
        <>
          <Skeleton width="45%" height={36} />
          <Skeleton width="75%" />
        </>
      ) : query.isError ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Unavailable
          </Typography>
          <Button size="small" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Stack>
      ) : (
        <>
          <Typography component="p" sx={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {value === undefined ? '—' : <AnimatedNumber value={value} format={format} />}
          </Typography>
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.75 }}>
            {caption}
          </Typography>
        </>
      )}
    </Card>
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
