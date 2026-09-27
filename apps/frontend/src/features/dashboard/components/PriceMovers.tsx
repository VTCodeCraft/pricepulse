import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { Section } from '../../../components/common/Section';
import { formatPrice } from '../../../lib/utils/format';
import { priceChangePct } from '../../../lib/utils/observations';
import { PriceChange } from '../../products/components/PriceChange';
import { useTrackedProducts } from '../../products/hooks/useTrackedProducts';
import { productPath } from '../../products/productInfo';

// The options whose latest scrape moved the most against the previous one, from the tracked list.
export function PriceMovers() {
  const tracked = useTrackedProducts();
  const movers = (tracked.data ?? [])
    .flatMap(item => {
      const pct = priceChangePct(item);
      return pct === null || pct === 0 ? [] : [{ item, pct }];
    })
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 5);

  return (
    <Section title="Largest price moves" description="Latest scrape against the previous one.">
      {tracked.data && movers.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No price has moved between two scrapes yet.
        </Typography>
      ) : (
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {movers.map(({ item, pct }) => (
            <Box
              component="li"
              key={item.id}
              sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', columnGap: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Link component={RouterLink} to={productPath(item.storeProductId, item.optionId)} color="text.primary" noWrap sx={{ display: 'block', fontWeight: 500, fontSize: '0.8125rem' }}>
                  {item.productName}
                </Link>
                <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary' }}>
                  {item.optionLabel}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {item.latest && formatPrice(item.latest.price, item.latest.currency)}
              </Typography>
              <Box sx={{ minWidth: 64, display: 'flex', justifyContent: 'flex-end', fontSize: '0.8125rem' }}>
                <PriceChange pct={pct} />
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Section>
  );
}
