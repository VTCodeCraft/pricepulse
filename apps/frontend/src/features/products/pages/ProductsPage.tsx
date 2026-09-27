import Add from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { TrackedProductsSection } from '../components/TrackedProductsSection';
import { TrackProductDialog } from '../components/TrackProductDialog';

export function ProductsPage() {
  const [tracking, setTracking] = useState(false);

  return (
    <>
      <PageHeader
        title="Tracked Products"
        subtitle="Every product option PricePulse checks on its schedule."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setTracking(true)}>
            Track Product
          </Button>
        }
      />
      <TrackedProductsSection onTrack={() => setTracking(true)} />
      <TrackProductDialog open={tracking} onClose={() => setTracking(false)} />
    </>
  );
}
