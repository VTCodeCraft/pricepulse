import Close from '@mui/icons-material/Close';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import Search from '@mui/icons-material/Search';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import type { CatalogProduct } from '../../../types/product';
import { useCatalogSearch } from '../hooks/useCatalog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useTrackedProducts } from '../hooks/useTrackedProducts';
import { SEARCH_LIMIT, searchQuery, searchView } from '../search';

type ProductSearchProps = { onSelect: (product: CatalogProduct) => void; autoFocus?: boolean };

export function ProductSearch({ onSelect, autoFocus = false }: ProductSearchProps) {
  const [input, setInput] = useState('');
  const typed = searchQuery(input);
  const searched = useDebouncedValue(typed, 300);
  const search = useCatalogSearch(searched);
  const tracked = useTrackedProducts();
  const view = searchView(typed, searched, search);
  const listRef = useRef<HTMLUListElement>(null);
  const resultsId = useId();

  const trackedCounts = new Map<number, number>();
  for (const item of tracked.data ?? []) trackedCounts.set(item.storeProductId, (trackedCounts.get(item.storeProductId) ?? 0) + 1);

  // Down arrow moves from the field into the results; up/down move between them.
  const focusResult = (index: number) => listRef.current?.querySelectorAll<HTMLElement>('[role="button"], button')[index]?.focus();
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="button"], button') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  return (
    <Box>
      <TextField
        fullWidth
        autoFocus={autoFocus}
        value={input}
        onChange={event => setInput(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && view === 'results') {
            event.preventDefault();
            focusResult(0);
          }
        }}
        placeholder="Search by product name, e.g. halvard tablet"
        slotProps={{
          htmlInput: { 'aria-label': 'Search the store catalogue', 'aria-controls': resultsId, maxLength: 100 },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: input && (
              <InputAdornment position="end">
                <IconButton size="small" edge="end" aria-label="Clear search" onClick={() => setInput('')}>
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Box id={resultsId} sx={{ mt: 1.5 }}>
        {view === 'hint' && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Type at least 2 characters. Every word you type must appear in the product name.
          </Typography>
        )}
        {view === 'loading' && (
          <Box role="status" aria-busy="true" aria-label="Searching" sx={{ display: 'grid', gap: 1 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={52} />
            ))}
          </Box>
        )}
        {view === 'syncing' && (
          <EmptyState
            icon={HourglassEmptyOutlined}
            title="The product catalogue is loading"
            description="PricePulse is reading the store’s catalogue for the first time. Search again in about two minutes."
            action={<Button onClick={() => search.refetch()}>Try again</Button>}
          />
        )}
        {view === 'error' && <ErrorState title="Search failed" message={search.error?.message} onRetry={() => search.refetch()} />}
        {view === 'empty' && (
          <EmptyState
            icon={SearchOffOutlined}
            title={`No products match “${searched}”`}
            description="Every word must appear in the product name. Try fewer or shorter words."
          />
        )}
        {view === 'results' && search.data && (
          <>
            <Typography role="status" variant="caption" component="p" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {search.data.results.length === SEARCH_LIMIT
                ? `Showing the first ${SEARCH_LIMIT} matches. Add words to narrow the search.`
                : `${search.data.results.length} ${search.data.results.length === 1 ? 'product' : 'products'}`}
            </Typography>
            <List ref={listRef} aria-label="Search results" disablePadding onKeyDown={onListKeyDown} sx={{ display: 'grid', gap: 0.5 }}>
              {search.data.results.map(product => {
                const trackedCount = trackedCounts.get(product.storeProductId) ?? 0;
                return (
                  <ListItemButton key={product.storeProductId} onClick={() => onSelect(product)} sx={{ py: 1 }}>
                    <ListItemText
                      primary={product.name}
                      secondary={[product.brand, product.category, product.sku].filter(Boolean).join(' · ')}
                      slotProps={{ primary: { sx: { fontWeight: 500, fontSize: '0.875rem' } } }}
                    />
                    {trackedCount > 0 && (
                      <Chip size="small" variant="outlined" color="primary" label={trackedCount === 1 ? 'Tracked' : `${trackedCount} tracked`} sx={{ ml: 1 }} />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </>
        )}
      </Box>
    </Box>
  );
}
