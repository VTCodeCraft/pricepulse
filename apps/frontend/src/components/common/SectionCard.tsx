import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';

type SectionCardProps = { title: string; description?: ReactNode; action?: ReactNode; children?: ReactNode };

// A titled card section: the heading labels the region, the action (filters, links) sits beside it.
export function SectionCard({ title, description, action, children }: SectionCardProps) {
  const headingId = useId();
  return (
    <Card component="section" aria-labelledby={headingId} sx={{ p: 2.5, minWidth: 0 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: children ? 2.5 : 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" id={headingId}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0, maxWidth: '100%' }}>{action}</Box>}
      </Stack>
      {children}
    </Card>
  );
}
