import Add from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { Section } from '../../../components/common/Section';
import { useTrackedProducts } from '../hooks/useTrackedProducts';
import { TrackedProductsTable } from './TrackedProductsTable';

export function TrackedProductsSection({ onTrack }: { onTrack: () => void }) {
  const { data, isPending, isError, error, refetch } = useTrackedProducts();

  return (
    <Section
      title="Tracked products"
      description={data && data.length > 0 ? `${data.length} ${data.length === 1 ? 'option' : 'options'} across the store.` : undefined}
    >
      {isPending ? (
        <LoadingSkeleton variant="table" label="Loading tracked products" />
      ) : isError ? (
        <ErrorState title="Unable to load tracked products" message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No tracked products yet."
          description="Track a product option to start collecting its price and stock."
          action={
            <Button variant="contained" startIcon={<Add />} onClick={onTrack}>
              Track Product
            </Button>
          }
        />
      ) : (
        <TrackedProductsTable items={data} />
      )}
    </Section>
  );
}
