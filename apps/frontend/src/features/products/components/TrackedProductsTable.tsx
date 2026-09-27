import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDateTime, formatPrice, formatRelativeTime, formatSignedPercent } from '../../../lib/utils/format';
import { priceChangePct, stockStatus } from '../../../lib/utils/observations';
import type { TrackedProduct } from '../../../types/product';
import { useRefreshPrice, useUntrack } from '../hooks/useTrackedProducts';

export function TrackedProductsTable({ items }: { items: TrackedProduct[] }) {
  const navigate = useNavigate();
  const refresh = useRefreshPrice();
  const untrack = useUntrack();
  const [pendingRemoval, setPendingRemoval] = useState<TrackedProduct | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // One scrape run at a time on the server, so every refresh button waits for the current one.
  const refreshingId = refresh.isPending ? refresh.variables.id : null;
  const startRefresh = refresh.mutate;

  const columns = useMemo<GridColDef<TrackedProduct>[]>(
    () => [
      {
        field: 'productName',
        headerName: 'Product',
        flex: 1.6,
        minWidth: 180,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Link component={RouterLink} to={`/products/${row.id}`} underline="hover" color="text.primary" noWrap sx={{ display: 'block', fontWeight: 600 }}>
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
        headerName: 'Current price',
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
        headerName: 'Price change',
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
          <GridActionsCellItem key="view" icon={<VisibilityOutlined fontSize="small" />} label="View details" title="View details" onClick={() => navigate(`/products/${row.id}`)} />,
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
            onClick={() => {
              setPendingRemoval(row);
              setConfirmOpen(true);
            }}
          />,
        ],
      },
    ],
    [navigate, startRefresh, refreshingId, untrack.isPending],
  );

  return (
    <>
      <DataGrid
        label="Tracked products"
        rows={items}
        columns={columns}
        autoHeight
        hideFooter
        disableColumnMenu
        disableRowSelectionOnClick
        rowHeight={64}
        columnHeaderHeight={44}
        sx={{
          border: 0,
          '--DataGrid-containerBackground': 'transparent',
          '& .MuiDataGrid-columnHeaderTitle': { fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' },
          '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', lineHeight: 1.43 },
        }}
      />
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} aria-labelledby="stop-tracking-title">
        <DialogTitle id="stop-tracking-title">Stop tracking this option?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingRemoval && `${pendingRemoval.productName} · ${pendingRemoval.optionLabel}`} will no longer be scraped. Its price
            history is kept, and tracking it again later continues it.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (pendingRemoval) untrack.mutate(pendingRemoval);
              setConfirmOpen(false);
            }}
          >
            Stop tracking
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// A drop is good news for a buyer: green with a down arrow. The arrow and sign carry the meaning, not the colour.
function PriceChange({ pct }: { pct: number | null }) {
  if (pct === null) return <>—</>;
  const Icon = pct < 0 ? ArrowDownward : ArrowUpward;
  return (
    <Stack
      direction="row"
      spacing={0.25}
      sx={{ alignItems: 'center', fontVariantNumeric: 'tabular-nums', color: pct < 0 ? 'success.main' : pct > 0 ? 'error.main' : 'text.secondary' }}
    >
      {pct !== 0 && <Icon sx={{ fontSize: 14 }} aria-hidden />}
      <span>{formatSignedPercent(pct)}</span>
    </Stack>
  );
}
