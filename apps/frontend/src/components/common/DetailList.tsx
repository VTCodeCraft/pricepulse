import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

// A label / value list (<dl>), label column sized to its longest label.
export function DetailList({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box component="dl" sx={[{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 3, rowGap: 1.25, m: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  );
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </>
  );
}
