import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/common/PageHeader';
import { Section } from '../../../components/common/Section';
import { ProductSearch } from '../components/ProductSearch';
import { TrackedProductsSection } from '../components/TrackedProductsSection';
import { TrackProductDialog } from '../components/TrackProductDialog';
import { productPath } from '../productInfo';

export function ProductsPage() {
  const [tracking, setTracking] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        eyebrow="Monitor"
        title="Tracked Products"
        subtitle="The options PricePulse scrapes on schedule. Find another product in the store catalogue to add it."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setTracking(true)}>
            Track Product
          </Button>
        }
      />
      <Stack spacing={5}>
        <Section title="Find a product" description="Search the store catalogue by name; a result opens its product page.">
          <Box sx={{ maxWidth: 640 }}>
            <ProductSearch onSelect={product => navigate(productPath(product.storeProductId))} />
          </Box>
        </Section>
        <TrackedProductsSection onTrack={() => setTracking(true)} />
      </Stack>
      <TrackProductDialog open={tracking} onClose={() => setTracking(false)} />
    </>
  );
}
