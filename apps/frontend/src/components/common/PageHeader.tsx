import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

type PageHeaderProps = { title: string; subtitle?: string; actions?: ReactNode };

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'space-between', mb: { xs: 2.5, md: 3.5 } }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h1">{title}</Typography>
        {subtitle && (
          <Typography variant="subtitle1" sx={{ mt: 0.75, color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
