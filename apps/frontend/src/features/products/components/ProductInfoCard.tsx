import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type { ProductInfo } from '../productInfo';
import { specRows } from '../productInfo';

// Only what the store provides: description, review summary, specifications.
export function ProductInfoCard({ info }: { info: ProductInfo }) {
  const specs = info.specs ? specRows(info.specs) : [];

  return (
    <Card component="section" aria-label="Product information" sx={{ p: 2.5 }}>
      <Typography variant="h2" component="h2">
        About this product
      </Typography>
      {info.description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          {info.description}
        </Typography>
      )}
      {info.reviewSummary && (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          Rated <strong>{info.reviewSummary.avgRating} / 5</strong> in {info.reviewSummary.count}{' '}
          {info.reviewSummary.count === 1 ? 'review' : 'reviews'} on the store
        </Typography>
      )}
      {specs.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', columnGap: 2, rowGap: 1, m: 0 }}>
            {specs.map(({ label, value }) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
      {!info.description && !info.reviewSummary && specs.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          The store gives no further details for this product.
        </Typography>
      )}
    </Card>
  );
}
