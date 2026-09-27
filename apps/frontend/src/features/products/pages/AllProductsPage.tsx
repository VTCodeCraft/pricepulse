import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { PageHeader } from '../../../components/common/PageHeader';
import { ApiError } from '../../../lib/api/client';
import type { CatalogListItem } from '../../../types/product';
import { CatalogProductCard } from '../components/CatalogProductCard';
import { TrackProductDialog } from '../components/TrackProductDialog';
import { useCatalogPage } from '../hooks/useCatalog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useTrackedProducts } from '../hooks/useTrackedProducts';
import { trackedOptionsOf } from '../productInfo';
import { searchQuery } from '../search';

// Every product of the INE demo store, a page at a time from the server (GET /api/catalog/products). The search and
// the page live in the URL, so coming back from a product page returns to the same place.
export function AllProductsPage() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [input, setInput] = useState(urlQuery);
  const query = searchQuery(useDebouncedValue(input, 300)) ?? ''; // fewer than 2 characters lists everything
  const page = query === urlQuery ? Math.max(1, Number.parseInt(params.get('page') ?? '', 10) || 1) : 1;
  const catalog = useCatalogPage(query, page);
  const tracked = useTrackedProducts();
  const [target, setTarget] = useState<CatalogListItem | null>(null);
  const [trackOpen, setTrackOpen] = useState(false);

  // A new search starts again from its first page.
  useEffect(() => {
    if (query !== urlQuery) setParams(query ? { q: query } : {}, { replace: true });
  }, [query, urlQuery, setParams]);

  const goToPage = (next: number) => {
    setParams({ ...(query && { q: query }), ...(next > 1 && { page: String(next) }) });
    window.scrollTo({ top: 0 });
  };
  const track = (product: CatalogListItem) => {
    setTarget(product);
    setTrackOpen(true);
  };

  const data = catalog.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const searching = searchQuery(input) !== (query || null) || (catalog.isFetching && catalog.isPlaceholderData);

  return (
    <>
      <PageHeader title="All Products" subtitle="Every product in the INE demo store. Open one for its details, or pick an option to track." />
      <Stack spacing={2.5}>
        <TextField
          label="Search products"
          placeholder="Search by name, e.g. drawing tablet"
          type="search"
          value={input}
          onChange={event => setInput(event.target.value)}
          helperText={input.trim().length === 1 ? 'Type at least 2 characters to search.' : ' '}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ maxWidth: 560 }}
        />

        {tracked.isError && !tracked.data && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={() => tracked.refetch()}>
                Try again
              </Button>
            }
          >
            Which options are tracked could not be loaded, so tracking status is not shown.
          </Alert>
        )}

        {catalog.isPending ? (
          <LoadingSkeleton variant="cards" label="Loading products" />
        ) : !data ? (
          catalog.error instanceof ApiError && catalog.error.code === 'catalog_syncing' ? (
            <EmptyState icon={StorefrontOutlined} title="The catalogue is loading" description={catalog.error.message} action={<RetryButton onClick={() => catalog.refetch()} />} />
          ) : (
            <ErrorState title="Unable to load the products" message={catalog.error?.message} onRetry={() => catalog.refetch()} />
          )
        ) : data.total === 0 ? (
          <EmptyState
            icon={SearchOffOutlined}
            title={`No products match “${data.query}”`}
            description="Every word must appear in the product name."
            action={
              <Button variant="outlined" size="small" onClick={() => setInput('')}>
                Clear search
              </Button>
            }
          />
        ) : (
          <>
            <div>
              <Box sx={{ height: 4, mb: 1 }}>{searching && <LinearProgress aria-label="Loading products" />}</Box>
              <Typography variant="body2" role="status" sx={{ color: 'text.secondary' }}>
                {data.query ? `${data.total} ${data.total === 1 ? 'product matches' : 'products match'} “${data.query}”` : `${data.total} products in the store`}
                {pages > 1 && ` · page ${data.page} of ${pages}`}
              </Typography>
            </div>
            {data.results.length === 0 ? (
              <EmptyState title="This page has no products" action={<RetryButton label="Go to the first page" onClick={() => goToPage(1)} />} />
            ) : (
              <Box
                component="ul"
                aria-label="Products"
                sx={{
                  m: 0,
                  p: 0,
                  listStyle: 'none',
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
                  opacity: catalog.isPlaceholderData ? 0.6 : 1,
                  '& > li': { display: 'flex', minWidth: 0 },
                  '& > li > *': { flex: 1 },
                }}
              >
                {data.results.map(product => (
                  <li key={product.storeProductId}>
                    <CatalogProductCard
                      product={product}
                      tracked={tracked.data ? trackedOptionsOf(tracked.data, product.storeProductId) : new Map()}
                      onTrack={track}
                    />
                  </li>
                ))}
              </Box>
            )}
            {pages > 1 && (
              <Pagination
                count={pages}
                page={data.page}
                onChange={(_, next) => goToPage(next)}
                siblingCount={1}
                aria-label="Product pages"
                sx={{ alignSelf: 'center', '& ul': { justifyContent: 'center' } }}
              />
            )}
          </>
        )}
      </Stack>

      {target && (
        <TrackProductDialog
          key={target.storeProductId}
          open={trackOpen}
          product={target}
          onClose={() => setTrackOpen(false)}
        />
      )}
    </>
  );
}

function RetryButton({ onClick, label = 'Try again' }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="outlined" size="small" onClick={onClick}>
      {label}
    </Button>
  );
}
