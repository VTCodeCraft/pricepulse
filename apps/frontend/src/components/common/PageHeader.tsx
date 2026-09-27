import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { eyebrow as eyebrowStyle } from '../../theme/theme';

type PageHeaderProps = { title: string; subtitle?: ReactNode; eyebrow?: string; actions?: ReactNode };

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between', mb: { xs: 3.5, md: 5 } }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography component="p" sx={{ ...eyebrowStyle, color: 'text.secondary', mb: 1.5 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h1">{title}</Typography>
        {subtitle && (
          <Typography variant="subtitle1" component="div" sx={{ mt: 1, color: 'text.secondary', maxWidth: '68ch', textWrap: 'pretty' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
