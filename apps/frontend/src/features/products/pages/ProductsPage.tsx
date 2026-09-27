import Add from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/common/PageHeader';
import { ProductSearch } from '../components/ProductSearch';
import { TrackedProductsSection } from '../components/TrackedProductsSection';
import { TrackProductDialog } from '../components/TrackProductDialog';
import { productPath } from '../productInfo';

export function ProductsPage() {
  const [tracking, setTracking] = useState(false);
  const navigate = useNavigate();
  const headingId = useId();

  return (
    <>
      <PageHeader
        title="Tracked Products"
        subtitle="Find a product in the store catalogue, or manage the options PricePulse already tracks."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setTracking(true)}>
            Track Product
          </Button>
        }
      />
      <Stack spacing={3}>
        <Card component="section" aria-labelledby={headingId} sx={{ p: 2.5 }}>
          <Typography variant="h2" id={headingId} sx={{ mb: 1.5 }}>
            Find a product
          </Typography>
          <ProductSearch onSelect={product => navigate(productPath(product.storeProductId))} />
        </Card>
        <TrackedProductsSection onTrack={() => setTracking(true)} />
      </Stack>
      <TrackProductDialog open={tracking} onClose={() => setTracking(false)} />
    </>
  );
}
