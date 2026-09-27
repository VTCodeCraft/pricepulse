import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { useTrackedProducts } from '../hooks/useTrackedProducts';
import { TrackedProductsTable } from './TrackedProductsTable';

export function TrackedProductsSection({ onTrack }: { onTrack: () => void }) {
  const { data, isPending, isError, error, refetch } = useTrackedProducts();
  const headingId = useId();

  return (
    <Card component="section" aria-labelledby={headingId}>
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography variant="h2" id={headingId}>
          Tracked products
        </Typography>
      </Box>
      <Divider />
      {isPending ? (
        <Box sx={{ p: 2.5 }}>
          <LoadingSkeleton variant="table" label="Loading tracked products" />
        </Box>
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
    </Card>
  );
}
