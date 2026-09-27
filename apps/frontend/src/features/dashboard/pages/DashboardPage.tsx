import Add from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { TrackedProductsSection } from '../../products/components/TrackedProductsSection';
import { TrackProductDialog } from '../../products/components/TrackProductDialog';
import { KpiCards } from '../components/KpiCards';

export function DashboardPage() {
  const [tracking, setTracking] = useState(false);

  return (
    <>
      <PageHeader
        title="Price Tracking Overview"
        subtitle="Monitor product prices, stock availability, and scraping health from one place."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setTracking(true)}>
            Track Product
          </Button>
        }
      />
      <Stack spacing={3}>
        <KpiCards />
        <TrackedProductsSection onTrack={() => setTracking(true)} />
      </Stack>
      <TrackProductDialog open={tracking} onClose={() => setTracking(false)} />
    </>
  );
}
