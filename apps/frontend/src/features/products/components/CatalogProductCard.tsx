import AddOutlined from '@mui/icons-material/AddOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import type { CatalogListItem, TrackedProduct } from '../../../types/product';
import { productPath, trackAction } from '../productInfo';

type CatalogProductCardProps = {
  product: CatalogListItem;
  tracked: Map<string, TrackedProduct>; // this product's tracked options, by option id
  onTrack: (product: CatalogListItem) => void;
};

// Only what the catalogue knows: name, store id, brand, category, SKU and, once fetched, the number of options.
export function CatalogProductCard({ product, tracked, onTrack }: CatalogProductCardProps) {
  const trackedLabels = [...tracked.values()].map(item => item.optionLabel);
  const action = trackAction(tracked.size, product.optionCount);
  const meta = [product.brand, product.category].filter(Boolean).join(' · ');

  return (
    <Card component="article" aria-label={product.name} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
      <div>
        <Link
          component={RouterLink}
          to={productPath(product.storeProductId)}
          underline="hover"
          color="text.primary"
          sx={{ fontWeight: 600, display: 'block', overflowWrap: 'anywhere' }}
        >
          {product.name}
        </Link>
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
          ID {product.storeProductId}
          {meta && ` · ${meta}`}
        </Typography>
        {product.sku && (
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
            SKU {product.sku}
          </Typography>
        )}
      </div>

      <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap' }}>
        {product.optionCount !== null && (
          <Chip size="small" variant="outlined" label={`${product.optionCount} ${product.optionCount === 1 ? 'option' : 'options'}`} />
        )}
        {tracked.size > 0 ? (
          <Chip
            size="small"
            color="primary"
            icon={<CheckOutlined />}
            label={tracked.size === 1 ? `Tracking ${trackedLabels[0]}` : `Tracking ${tracked.size} options`}
            title={trackedLabels.join(', ')}
          />
        ) : (
          <Chip size="small" variant="outlined" label="Not tracked" />
        )}
      </Stack>

      <Button
        variant={tracked.size > 0 ? 'outlined' : 'contained'}
        size="small"
        startIcon={action.disabled ? <CheckOutlined /> : <AddOutlined />}
        disabled={action.disabled}
        onClick={() => onTrack(product)}
        aria-label={`${action.label}: ${product.name}`}
        sx={{ mt: 'auto', alignSelf: 'flex-start' }}
      >
        {action.label}
      </Button>
    </Card>
  );
}
