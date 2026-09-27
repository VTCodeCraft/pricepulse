import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { eyebrow } from '../../theme/theme';

// One labelled figure with an optional note under it.
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="p" sx={{ ...eyebrow, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography component="div" sx={{ fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', mt: 0.75, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {note && (
        <Typography variant="caption" component="div" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}
