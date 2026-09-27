import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Section } from '../../../components/common/Section';
import { eyebrow } from '../../../theme/theme';
import type { ProductInfo } from '../productInfo';
import { specRows } from '../productInfo';

// Only what the store provides: description, review summary, specifications.
export function ProductInfoCard({ info }: { info: ProductInfo }) {
  const specs = info.specs ? specRows(info.specs) : [];

  return (
    <Section
      layout="aside"
      title="About this product"
      description={
        <>
          {info.description ?? (specs.length === 0 && !info.reviewSummary ? 'The store gives no further details for this product.' : null)}
          {info.reviewSummary && (
            <Typography variant="body2" component="span" sx={{ display: 'block', mt: 1.5, color: 'text.primary' }}>
              Rated <strong>{info.reviewSummary.avgRating} / 5</strong> in {info.reviewSummary.count}{' '}
              {info.reviewSummary.count === 1 ? 'review' : 'reviews'} on the store
            </Typography>
          )}
        </>
      }
    >
      {specs.length > 0 && (
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 4 }}>
          {specs.map(({ label, value }) => (
            <Box key={label} sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}>
              <Typography component="dt" sx={{ ...eyebrow, color: 'text.secondary' }}>
                {label}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.5, overflowWrap: 'anywhere' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Section>
  );
}
