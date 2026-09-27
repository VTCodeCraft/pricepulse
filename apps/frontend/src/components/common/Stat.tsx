import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

// One labelled figure with an optional note under it.
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography component="div" sx={{ fontSize: '1.125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
        {value}
      </Typography>
      {note && (
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}
