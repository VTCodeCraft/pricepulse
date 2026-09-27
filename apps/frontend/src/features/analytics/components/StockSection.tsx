import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Section } from '../../../components/common/Section';
import { Stat } from '../../../components/common/Stat';
import type { TrackedProduct } from '../../../types/product';
import { attemptStock } from '../../scraping/scrapeLog';
import { stockCounts } from '../analytics';

// The store reports a unit count (0 when sold out) and nothing else, so there is no "low stock" state.
export function StockSection({ items }: { items: TrackedProduct[] }) {
  const counts = stockCounts(items);
  const rows = [...items].sort((a, b) => (b.latest?.stock ?? -1) - (a.latest?.stock ?? -1));
  const max = Math.max(1, ...rows.map(item => item.latest?.stock ?? 0));

  return (
    <Section title="Stock availability" description={`Latest scraped stock of the ${items.length} tracked ${items.length === 1 ? 'option' : 'options'}.`}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', mb: 2.5 }}>
        <Stat label="In stock" value={counts.inStock} note={`of ${items.length}`} />
        <Stat label="Out of stock" value={counts.outOfStock} note={`of ${items.length}`} />
        <Stat label="Not scraped yet" value={counts.unknown} />
      </Box>
      <Box component="ul" aria-label="Units in stock per option" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.25 }}>
        {rows.map(item => {
          const stock = item.latest?.stock ?? null;
          return (
            <Box component="li" key={item.id} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1.5, rowGap: 0.5, alignItems: 'center' }}>
              <Typography variant="body2" noWrap title={`${item.productName} · ${item.optionLabel}`}>
                {item.productName} · {item.optionLabel}
              </Typography>
              <Typography variant="body2" sx={{ color: stock === 0 ? 'error.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums', fontWeight: stock === 0 ? 600 : 400 }}>
                {attemptStock({ stock })}
              </Typography>
              <Box aria-hidden sx={{ gridColumn: '1 / -1', height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${((stock ?? 0) / max) * 100}%`, bgcolor: 'primary.main', borderRadius: 3 }} />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Section>
  );
}
