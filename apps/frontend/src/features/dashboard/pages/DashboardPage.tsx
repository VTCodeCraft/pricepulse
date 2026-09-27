import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { TrackedProductsSection } from '../../products/components/TrackedProductsSection';
import { TrackProductDialog } from '../../products/components/TrackProductDialog';
import { ExportCsvButton } from '../../scraping/components/ExportCsvButton';
import { KpiCards } from '../components/KpiCards';
import { PriceMovers } from '../components/PriceMovers';
import { RecentActivity } from '../components/RecentActivity';

export function DashboardPage() {
  const [tracking, setTracking] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="PricePulse"
        title="Price monitoring"
        subtitle="Prices, stock and scrape health for every tracked option of the INE demo store, from the scheduled runs."
        actions={
          <>
            <ExportCsvButton variant="outlined" />
            <Button variant="contained" startIcon={<Add />} onClick={() => setTracking(true)}>
              Track Product
            </Button>
          </>
        }
      />
      <Stack spacing={5}>
        <KpiCards />
        <TrackedProductsSection onTrack={() => setTracking(true)} />
        <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
          <PriceMovers />
          <RecentActivity />
        </Box>
      </Stack>
      <TrackProductDialog open={tracking} onClose={() => setTracking(false)} />
    </>
  );
}
