import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import type { Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDateTime, formatPrice, formatRelativeTime } from '../../../lib/utils/format';
import { priceChangePct, stockStatus } from '../../../lib/utils/observations';
import type { TrackedProduct } from '../../../types/product';
import { useRefreshPrice, useUntrack } from '../hooks/useTrackedProducts';
import { productPath } from '../productInfo';
import { PriceChange } from './PriceChange';
import { StopTrackingDialog } from './StopTrackingDialog';

export function TrackedProductsTable({ items }: { items: TrackedProduct[] }) {
  const navigate = useNavigate();
  const refresh = useRefreshPrice();
  const untrack = useUntrack();
  const [pendingRemoval, setPendingRemoval] = useState<TrackedProduct | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // One scrape run at a time on the server, so every refresh button waits for the current one.
  const refreshingId = refresh.isPending ? refresh.variables.id : null;
  const startRefresh = refresh.mutate;
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));

  // State setters only, so the memoised columns can keep the first copy.
  const askToRemove = (item: TrackedProduct) => {
    setPendingRemoval(item);
    setConfirmOpen(true);
  };

  const columns = useMemo<GridColDef<TrackedProduct>[]>(
    () => [
      {
        field: 'productName',
        headerName: 'Product',
        flex: 1.6,
        minWidth: 180,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Link component={RouterLink} to={productPath(row.storeProductId, row.optionId)} underline="hover" color="text.primary" noWrap sx={{ display: 'block', fontWeight: 500 }}>
              {row.productName}
            </Link>
            <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary' }}>
              {[row.brand, row.category].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'optionLabel',
        headerName: 'Option',
        flex: 0.9,
        minWidth: 110,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.optionLabel}
            </Typography>
            {row.optionAxis && (
              <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary' }}>
                {row.optionAxis}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: 'price',
        headerName: 'Price',
        type: 'number',
        minWidth: 105,
        valueGetter: (_, row) => row.latest?.price ?? null,
        renderCell: ({ row }) => (row.latest ? formatPrice(row.latest.price, row.latest.currency) : '—'),
      },
      {
        field: 'stock',
        headerName: 'Stock',
        minWidth: 120,
        valueGetter: (_, row) => row.latest?.stock ?? null,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <StatusBadge status={stockStatus(row.latest?.stock)} />
            {row.latest && row.latest.stock > 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {row.latest.stock}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'change',
        headerName: 'Change',
        type: 'number',
        minWidth: 105,
        valueGetter: (_, row) => priceChangePct(row),
        renderCell: ({ value }) => <PriceChange pct={value ?? null} />,
      },
      {
        field: 'lastScrape',
        headerName: 'Last scrape',
        minWidth: 110,
        valueGetter: (_, row) => row.lastAttempt?.finishedAt ?? null,
        renderCell: ({ row }) =>
          row.lastAttempt ? (
            <Tooltip title={formatDateTime(row.lastAttempt.finishedAt)}>
              <span>{formatRelativeTime(row.lastAttempt.finishedAt)}</span>
            </Tooltip>
          ) : (
            'Not yet'
          ),
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 105,
        valueGetter: (_, row) => row.lastAttempt?.outcome ?? null,
        renderCell: ({ row }) => (row.lastAttempt ? <StatusBadge status={row.lastAttempt.outcome} /> : '—'),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 112,
        getActions: ({ row }) => [
          <GridActionsCellItem key="view" icon={<VisibilityOutlined fontSize="small" />} label="View details" title="View details" onClick={() => navigate(productPath(row.storeProductId, row.optionId))} />,
          <GridActionsCellItem
            key="refresh"
            icon={refreshingId === row.id ? <CircularProgress size={16} /> : <RefreshOutlined fontSize="small" />}
            label="Refresh price"
            title="Refresh price"
            disabled={refreshingId !== null}
            onClick={() => startRefresh(row)}
          />,
          <GridActionsCellItem
            key="remove"
            icon={<DeleteOutlineOutlined fontSize="small" />}
            label="Stop tracking"
            title="Stop tracking"
            disabled={untrack.isPending}
            onClick={() => askToRemove(row)}
          />,
        ],
      },
    ],
    [navigate, startRefresh, refreshingId, untrack.isPending],
  );

  return (
    <>
      {compact ? (
        // Phones: one row per option with the same figures and actions, instead of a sideways-scrolling grid.
        <Box component="ul" aria-label="Tracked products" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: 1, borderColor: 'divider' }}>
          {items.map(row => (
            <Box component="li" key={row.id} sx={{ py: 1.75, borderBottom: 1, borderColor: 'divider', display: 'grid', gap: 1 }}>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Link component={RouterLink} to={productPath(row.storeProductId, row.optionId)} color="text.primary" sx={{ fontWeight: 500, fontSize: '0.875rem', display: 'block' }}>
                    {row.productName}
                  </Link>
                  <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                    {row.optionLabel}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {row.latest ? formatPrice(row.latest.price, row.latest.currency) : '—'}
                  </Typography>
                  <Box sx={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <PriceChange pct={priceChangePct(row)} />
                  </Box>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={stockStatus(row.latest?.stock)} />
                {row.lastAttempt && <StatusBadge status={row.lastAttempt.outcome} />}
                <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                  {row.lastAttempt ? formatRelativeTime(row.lastAttempt.finishedAt) : 'Not scraped yet'}
                </Typography>
                <IconButton size="small" aria-label={`Refresh price: ${row.productName} · ${row.optionLabel}`} disabled={refreshingId !== null} onClick={() => startRefresh(row)}>
                  {refreshingId === row.id ? <CircularProgress size={16} /> : <RefreshOutlined fontSize="small" />}
                </IconButton>
                <IconButton size="small" aria-label={`Stop tracking: ${row.productName} · ${row.optionLabel}`} disabled={untrack.isPending} onClick={() => askToRemove(row)}>
                  <DeleteOutlineOutlined fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}
        </Box>
      ) : (
        <DataGrid label="Tracked products" rows={items} columns={columns} autoHeight hideFooter disableRowSelectionOnClick rowHeight={60} />
      )}
      <StopTrackingDialog item={pendingRemoval} open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={untrack.mutate} />
    </>
  );
}

