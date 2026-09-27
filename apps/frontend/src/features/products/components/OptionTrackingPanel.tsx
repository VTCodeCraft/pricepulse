import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { formatDistanceToNowStrict, isPast } from 'date-fns';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDateTime, formatPrice, formatRelativeTime } from '../../../lib/utils/format';
import { priceChangePct, stockStatus } from '../../../lib/utils/observations';
import type { ProductOption, TrackedProduct } from '../../../types/product';
import { useRefreshPrice, useTrackProduct, useUntrack } from '../hooks/useTrackedProducts';
import { firstScrapeNote } from '../trackForm';
import { PriceChange } from './PriceChange';
import { StopTrackingDialog } from './StopTrackingDialog';

type OptionTrackingPanelProps = {
  storeProductId: number;
  productName: string;
  option: ProductOption;
  item: TrackedProduct | undefined; // the option's tracking record, when it is tracked
};

export function OptionTrackingPanel({ storeProductId, productName, option, item }: OptionTrackingPanelProps) {
  return item ? <TrackedOption item={item} /> : <UntrackedOption storeProductId={storeProductId} productName={productName} option={option} />;
}

function TrackedOption({ item }: { item: TrackedProduct }) {
  const refresh = useRefreshPrice();
  const untrack = useUntrack();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextScrape = new Date(item.nextScrapeAt);

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 1 }}>
        <Typography variant="h2">{item.optionLabel}</Typography>
        {item.lastAttempt && <StatusBadge status={item.lastAttempt.outcome} />}
      </Stack>

      <Typography component="p" sx={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', mt: 1.5 }}>
        {item.latest ? formatPrice(item.latest.price, item.latest.currency) : '—'}
      </Typography>
      {!item.latest && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No price yet: the first scrape has not produced one.
        </Typography>
      )}

      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1.25, my: 2.5 }}>
        <Detail label="Stock">
          <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
            <StatusBadge status={stockStatus(item.latest?.stock)} />
            {item.latest && item.latest.stock > 0 && <span>{item.latest.stock} units</span>}
          </Stack>
        </Detail>
        <Detail label="Change">
          <PriceChange pct={priceChangePct(item)} />
          {item.previous && (
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
              from {formatPrice(item.previous.price)}
            </Typography>
          )}
        </Detail>
        {item.latest?.mrp != null && <Detail label="MRP shown">{formatPrice(item.latest.mrp, item.latest.currency)}</Detail>}
        {item.latest?.memberPrice != null && <Detail label="Member price shown">{formatPrice(item.latest.memberPrice, item.latest.currency)}</Detail>}
        <Detail label="Last scraped">
          {item.lastAttempt ? (
            <Tooltip title={formatDateTime(item.lastAttempt.finishedAt)}>
              <span>
                {formatRelativeTime(item.lastAttempt.finishedAt)}
                {item.lastAttempt.errorCode && ` · ${item.lastAttempt.errorCode}`}
              </span>
            </Tooltip>
          ) : (
            'Not yet'
          )}
        </Detail>
        <Detail label="Next scrape">
          <Tooltip title={formatDateTime(item.nextScrapeAt)}>
            <span>{isPast(nextScrape) ? 'Due now' : `In ${formatDistanceToNowStrict(nextScrape)}`}</span>
          </Tooltip>
        </Detail>
        <Detail label="Tracked since">{formatDateTime(item.createdAt)}</Detail>
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button
          variant="contained"
          startIcon={<RefreshOutlined />}
          loading={refresh.isPending && refresh.variables.id === item.id}
          disabled={refresh.isPending}
          onClick={() => refresh.mutate(item)}
        >
          Refresh price
        </Button>
        <Button color="error" startIcon={<DeleteOutlineOutlined />} disabled={untrack.isPending} onClick={() => setConfirmOpen(true)}>
          Stop tracking
        </Button>
      </Stack>
      <StopTrackingDialog item={item} open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={untrack.mutate} />
    </>
  );
}

function UntrackedOption({ storeProductId, productName, option }: { storeProductId: number; productName: string; option: ProductOption }) {
  const trackProduct = useTrackProduct();

  return (
    <>
      <Typography variant="h2">{option.label}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 2.5 }}>
        This option is not tracked. Tracking it records its price and stock every 2 hours, starting now.
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddOutlined />}
        loading={trackProduct.isPending}
        onClick={() =>
          trackProduct.mutate(
            { storeProductId, optionId: option.id },
            { onSuccess: response => toast.success(`Tracking ${productName} · ${option.label}`, { description: firstScrapeNote(response) }) },
          )
        }
      >
        Track this option
      </Button>
      {trackProduct.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {trackProduct.error.message}
        </Alert>
      )}
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {children}
      </Typography>
    </>
  );
}
