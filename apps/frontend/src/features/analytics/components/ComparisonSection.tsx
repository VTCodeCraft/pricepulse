import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Link as RouterLink } from 'react-router-dom';
import { SectionCard } from '../../../components/common/SectionCard';
import { formatPrice } from '../../../lib/utils/format';
import { PriceChange } from '../../products/components/PriceChange';
import { productPath } from '../../products/productInfo';
import { attemptStock } from '../../scraping/scrapeLog';
import type { ComparisonRow } from '../analytics';

const columns: GridColDef<ComparisonRow>[] = [
  {
    field: 'product',
    headerName: 'Product',
    flex: 1.6,
    minWidth: 200,
    valueGetter: (_, row) => row.item.productName,
    renderCell: ({ row: { item } }) => (
      <Box sx={{ minWidth: 0 }}>
        <Link component={RouterLink} to={productPath(item.storeProductId, item.optionId)} underline="hover" color="text.primary" noWrap sx={{ display: 'block', fontWeight: 600 }}>
          {item.productName}
        </Link>
        <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary' }}>
          {item.optionLabel}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'price',
    headerName: 'Current price',
    type: 'number',
    minWidth: 115,
    valueGetter: (_, row) => row.item.latest?.price ?? null,
    renderCell: ({ row: { item } }) => (item.latest ? formatPrice(item.latest.price, item.latest.currency) : '—'),
  },
  {
    field: 'changePct',
    headerName: 'Change',
    type: 'number',
    minWidth: 100,
    renderCell: ({ row }) => <PriceChange pct={row.changePct} />,
  },
  { field: 'successful', headerName: 'Successful', type: 'number', minWidth: 100 },
  { field: 'failed', headerName: 'Failed', type: 'number', minWidth: 80 },
  {
    field: 'stock',
    headerName: 'Stock',
    type: 'number',
    minWidth: 115,
    valueGetter: (_, row) => row.item.latest?.stock ?? null,
    renderCell: ({ row: { item } }) => attemptStock({ stock: item.latest?.stock ?? null }),
  },
];

export function ComparisonSection({ rows, rangeDescription }: { rows: ComparisonRow[]; rangeDescription: string }) {
  return (
    <SectionCard
      title="Product comparison"
      description={`Every tracked option. Change is the latest scrape against the previous one; attempt counts cover ${rangeDescription}. Select a column header to sort.`}
    >
      <DataGrid
        label="Tracked options compared"
        rows={rows}
        columns={columns}
        autoHeight
        hideFooter
        disableColumnMenu
        disableRowSelectionOnClick
        rowHeight={60}
        columnHeaderHeight={44}
        sx={{
          border: 0,
          '--DataGrid-containerBackground': 'transparent',
          '& .MuiDataGrid-columnHeaderTitle': { fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' },
          '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', lineHeight: 1.43 },
        }}
      />
    </SectionCard>
  );
}
