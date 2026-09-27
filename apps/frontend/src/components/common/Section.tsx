import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';

type SectionProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  // `aside` puts the heading in a narrow column beside the content (settings); otherwise it sits above.
  layout?: 'stacked' | 'aside';
};

// A page section: a hairline rule, a heading that labels the region, and its content directly on the page.
export function Section({ title, description, action, children, layout = 'stacked' }: SectionProps) {
  const headingId = useId();
  const heading = (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h2" id={headingId}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" component="div" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: '72ch', textWrap: 'pretty' }}>
          {description}
        </Typography>
      )}
    </Box>
  );

  if (layout === 'aside') {
    return (
      <Box
        component="section"
        aria-labelledby={headingId}
        sx={{ borderTop: 1, borderColor: 'divider', py: 3.5, display: 'grid', gap: { xs: 2, md: 6 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 2fr)' } }}
      >
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          {heading}
          {action}
        </Stack>
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Box>
    );
  }

  return (
    <Box component="section" aria-labelledby={headingId} sx={{ borderTop: 1, borderColor: 'divider', pt: 3, minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' }, mb: children ? 2.5 : 0 }}
      >
        {heading}
        {action && <Box sx={{ flexShrink: 0, maxWidth: '100%' }}>{action}</Box>}
      </Stack>
      {children}
    </Box>
  );
}
