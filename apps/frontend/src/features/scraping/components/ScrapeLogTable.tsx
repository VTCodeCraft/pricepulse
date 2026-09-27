import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useState } from 'react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDateTime, formatDuration, formatTimestamp } from '../../../lib/utils/format';
import { attemptDurationMs, attemptPrice, attemptStatus, attemptStock, attemptTime, triesLabel, type LogEntry } from '../scrapeLog';
import { AttemptDrawer } from './AttemptDrawer';

const twoLines = (primary: string, secondary: string) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
      {primary}
    </Typography>
    <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary' }}>
      {secondary}
    </Typography>
  </Box>
);

const columns: GridColDef<LogEntry>[] = [
  {
    field: 'time',
    headerName: 'Timestamp',
    type: 'dateTime',
    minWidth: 150,
    valueGetter: (_, row) => new Date(attemptTime(row)),
    renderCell: ({ row }) => (
      <Tooltip title={formatTimestamp(attemptTime(row))}>
        <span>{formatDateTime(attemptTime(row))}</span>
      </Tooltip>
    ),
  },
  {
    field: 'productName',
    headerName: 'Product',
    flex: 1.4,
    minWidth: 170,
    renderCell: ({ row }) => twoLines(row.productName, row.isTracked ? `Store #${row.storeProductId}` : 'No longer tracked'),
  },
  { field: 'optionLabel', headerName: 'Option', flex: 0.7, minWidth: 110 },
  {
    field: 'id',
    headerName: 'Attempt',
    minWidth: 90,
    renderCell: ({ row }) => twoLines(`#${row.id}`, triesLabel(row.tries)),
  },
  {
    field: 'outcome',
    headerName: 'Status',
    minWidth: 110,
    renderCell: ({ row }) => <StatusBadge status={attemptStatus(row.outcome)} />,
  },
  { field: 'price', headerName: 'Price', type: 'number', minWidth: 100, renderCell: ({ row }) => attemptPrice(row) },
  { field: 'stock', headerName: 'Stock', type: 'number', minWidth: 110, renderCell: ({ row }) => attemptStock(row) },
  {
    field: 'duration',
    headerName: 'Duration',
    type: 'number',
    minWidth: 100,
    valueGetter: (_, row) => attemptDurationMs(row),
    renderCell: ({ value }) => (value == null ? '—' : formatDuration(value)),
  },
  {
    field: 'errorCode',
    headerName: 'Error',
    flex: 1,
    minWidth: 140,
    renderCell: ({ row }) =>
      row.errorCode ? (
        <Tooltip title={row.errorMessage ?? ''}>
          <Typography variant="body2" noWrap sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '0.75rem' }}>
            {row.errorCode}
          </Typography>
        </Tooltip>
      ) : (
        '—'
      ),
  },
];

type ScrapeLogTableProps = {
  entries: LogEntry[];
  label: string;
  showOption?: boolean; // product and option columns; hidden when the table belongs to one option
  pageSize?: number;
};

// Clicking a row, or pressing Enter on it, opens the attempt's details.
export function ScrapeLogTable({ entries, label, showOption = true, pageSize = 25 }: ScrapeLogTableProps) {
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [open, setOpen] = useState(false);
  const show = (entry: LogEntry) => {
    setSelected(entry);
    setOpen(true);
  };

  return (
    <>
      <DataGrid
        label={label}
        rows={entries}
        columns={columns}
        columnVisibilityModel={{ productName: showOption, optionLabel: showOption }}
        initialState={{ pagination: { paginationModel: { pageSize } }, sorting: { sortModel: [{ field: 'time', sort: 'desc' }] } }}
        pageSizeOptions={[10, 25, 50, 100]}
        autoHeight
        disableColumnMenu
        disableRowSelectionOnClick
        rowHeight={56}
        columnHeaderHeight={44}
        onRowClick={({ row }) => show(row)}
        onCellKeyDown={({ row }, event) => {
          if (event.key === 'Enter') show(row);
        }}
        sx={{
          border: 0,
          '--DataGrid-containerBackground': 'transparent',
          '& .MuiDataGrid-columnHeaderTitle': { fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' },
          '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', lineHeight: 1.43 },
          '& .MuiDataGrid-row': { cursor: 'pointer' },
        }}
      />
      <AttemptDrawer entry={selected} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
