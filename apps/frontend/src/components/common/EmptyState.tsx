import type { SvgIconComponent } from '@mui/icons-material';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: SvgIconComponent;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
};

export function EmptyState({ title, description, icon: Icon = InboxOutlined, action, tone = 'neutral' }: EmptyStateProps) {
  return (
    <Stack role={tone === 'error' ? 'alert' : undefined} spacing={1.25} sx={{ alignItems: 'center', textAlign: 'center', py: 6, px: 3 }}>
      <Box
        sx={theme => ({
          width: 44,
          height: 44,
          mb: 0.5,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          color: tone === 'error' ? 'error.main' : 'text.secondary',
          bgcolor: tone === 'error' ? `rgba(${theme.vars.palette.error.mainChannel} / 0.1)` : 'action.hover',
        })}
      >
        <Icon fontSize="small" />
      </Box>
      <Typography variant="h3" component="p">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 440 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}
