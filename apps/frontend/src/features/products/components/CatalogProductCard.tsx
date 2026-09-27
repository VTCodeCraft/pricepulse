import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { eyebrow, monospace, motion } from '../../../theme/theme';
import type { CatalogListItem, TrackedProduct } from '../../../types/product';
import { productPath, trackAction } from '../productInfo';

type CatalogProductCardProps = {
  product: CatalogListItem;
  tracked: Map<string, TrackedProduct>; // this product's tracked options, by option id
  onTrack: (product: CatalogListItem) => void;
};

// One cell of the catalogue grid. Only what the catalogue knows: category, name, brand, store id, SKU and, once
// fetched, the number of options; plus which options PricePulse tracks.
export function CatalogProductCard({ product, tracked, onTrack }: CatalogProductCardProps) {
  const trackedLabels = [...tracked.values()].map(item => item.optionLabel);
  const action = trackAction(tracked.size, product.optionCount);

  return (
    <Box
      component="article"
      aria-label={product.name}
      sx={{
        height: '100%',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minWidth: 0,
        transition: `background-color 160ms ${motion.css}`,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <div>
        <Typography component="p" sx={{ ...eyebrow, color: 'text.secondary', mb: 0.75 }}>
          {product.category ?? 'Uncategorised'}
        </Typography>
        <Link
          component={RouterLink}
          to={productPath(product.storeProductId)}
          color="text.primary"
          sx={{ fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '-0.01em', display: 'block', overflowWrap: 'anywhere' }}
        >
          {product.name}
        </Link>
        <Typography component="p" sx={{ ...monospace, color: 'text.secondary', mt: 0.5 }}>
          {[product.brand, `ID ${product.storeProductId}`, product.sku].filter(Boolean).join(' · ')}
        </Typography>
      </div>

      <Typography component="p" variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: tracked.size ? 'text.primary' : 'text.secondary' }}>
        {tracked.size > 0 && <Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: 0.25, bgcolor: 'primary.main', flexShrink: 0 }} />}
        <span title={trackedLabels.join(', ') || undefined}>
          {tracked.size === 0 ? 'Not tracked' : tracked.size === 1 ? `Tracking ${trackedLabels[0]}` : `Tracking ${tracked.size} options`}
          {product.optionCount !== null && ` · ${product.optionCount} ${product.optionCount === 1 ? 'option' : 'options'}`}
        </span>
      </Typography>

      <Button
        size="small"
        variant={tracked.size > 0 ? 'text' : 'outlined'}
        disabled={action.disabled}
        onClick={() => onTrack(product)}
        aria-label={`${action.label}: ${product.name}`}
        sx={{ mt: 'auto', alignSelf: 'flex-start', ml: tracked.size > 0 ? -1.25 : 0 }}
      >
        {action.label} {!action.disabled && '→'}
      </Button>
    </Box>
  );
}
