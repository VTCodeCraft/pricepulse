import AddOutlined from '@mui/icons-material/AddOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import TouchAppOutlined from '@mui/icons-material/TouchAppOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { PageHeader } from '../../../components/common/PageHeader';
import { ApiError } from '../../../lib/api/client';
import { OptionScrapeLog } from '../../scraping/components/OptionScrapeLog';
import { OptionSelector } from '../components/OptionSelector';
import { OptionTrackingPanel } from '../components/OptionTrackingPanel';
import { PriceHistorySection } from '../components/PriceHistorySection';
import { ProductInfoCard } from '../components/ProductInfoCard';
import { TrackProductDialog } from '../components/TrackProductDialog';
import { useProduct } from '../hooks/useCatalog';
import { useTrackedProducts } from '../hooks/useTrackedProducts';
import { productInfo, trackedOptionsOf } from '../productInfo';

// /products/:id is one store product; ?option=oN picks which of its options to show.
export function ProductDetailsPage() {
  const { id } = useParams();
  const storeProductId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const [params, setParams] = useSearchParams();
  const optionId = params.get('option') ?? '';
  const live = useProduct(storeProductId);
  const tracked = useTrackedProducts();
  const [tracking, setTracking] = useState(false);

  if (storeProductId === null) return <ProductNotFound />;

  const trackedHere = trackedOptionsOf(tracked.data ?? [], storeProductId);
  const info = productInfo(live.data, trackedHere.values().next().value);

  if (!info) {
    if (live.isPending || tracked.isPending) return <PageSkeleton />;
    if (live.error instanceof ApiError && live.error.code === 'product_not_found') return <ProductNotFound />;
    return <ErrorState title="Unable to load this product" message={live.error?.message} onRetry={() => live.refetch()} />;
  }

  const option = info.options.find(o => o.id === optionId);
  const trackedOption = option && trackedHere.get(option.id);
  const subtitle = [info.brand, info.category, info.sku, `Store #${storeProductId}`].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title={info.name}
        subtitle={subtitle}
        actions={
          <Button variant="outlined" href={info.productUrl} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNew fontSize="small" />}>
            View in store
          </Button>
        }
      />
      {live.isError && !live.data && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          The store did not answer ({live.error.message}). Showing the details saved when this product was tracked.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' }, alignItems: 'start' }}>
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Card component="section" aria-label="Options" sx={{ p: 2.5 }}>
            <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="h2">Options</Typography>
              {tracked.data && (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {trackedHere.size} of {info.options.length} tracked
                  </Typography>
                  {trackedHere.size < info.options.length && (
                    <Button size="small" variant="outlined" startIcon={<AddOutlined />} onClick={() => setTracking(true)}>
                      Track options
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
            <OptionSelector
              label={info.optionAxis ?? 'Option'}
              options={info.options}
              value={option ? option.id : ''}
              onChange={next => setParams({ option: next }, { replace: true })}
              tracked={trackedHere}
            />
          </Card>

          <Card component="section" aria-label="Selected option" sx={{ p: 2.5 }}>
            {tracked.isPending ? (
              <LoadingSkeleton variant="table" rows={3} label="Loading tracking state" />
            ) : !tracked.data ? (
              <ErrorState title="Unable to load the tracking state" message={tracked.error?.message} onRetry={() => tracked.refetch()} />
            ) : option ? (
              <OptionTrackingPanel storeProductId={storeProductId} productName={info.name} option={option} item={trackedOption} />
            ) : (
              <EmptyState
                icon={TouchAppOutlined}
                title={`Choose a ${(info.optionAxis ?? 'option').toLowerCase()}`}
                description="Its price, stock and tracking state appear here."
              />
            )}
          </Card>
        </Stack>

        <ProductInfoCard info={info} />
      </Box>
      <TrackProductDialog
        open={tracking}
        onClose={() => setTracking(false)}
        product={{ storeProductId, name: info.name, brand: info.brand, category: info.category, sku: info.sku }}
      />

      {trackedOption && (
        <Stack spacing={3} sx={{ mt: 3 }}>
          <PriceHistorySection item={trackedOption} />
          <OptionScrapeLog item={trackedOption} />
        </Stack>
      )}
    </>
  );
}

function ProductNotFound() {
  return (
    <EmptyState
      icon={SearchOffOutlined}
      title="Product not found"
      description="The store has no product with this number."
      action={
        <Button component={RouterLink} to="/products" variant="contained">
          Back to products
        </Button>
      }
    />
  );
}

function PageSkeleton() {
  return (
    <Box role="status" aria-busy="true" aria-label="Loading product">
      <Skeleton width="45%" height={40} />
      <Skeleton width="30%" sx={{ mb: 3 }} />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' } }}>
        <Skeleton variant="rounded" height={260} />
        <Skeleton variant="rounded" height={260} />
      </Box>
    </Box>
  );
}
