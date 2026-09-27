import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// The PricePulse mark: a geometric P (stem and bowl in the text colour) with an orange square beside it, the latest
// data point. Drawn on a 24-unit grid so every stroke is the same 4.5 units wide and it stays crisp from 20 px up.
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: size, height: size, flexShrink: 0, display: 'block' }}>
      <Box component="path" d="M4 3h4.5v18H4zM8.5 3H13a6 6 0 0 1 0 12H8.5v-4.5H13a1.5 1.5 0 0 0 0-3H8.5z" sx={{ fill: 'currentColor' }} />
      <Box component="rect" x="15.5" y="16.5" width="4.5" height="4.5" rx="0.75" sx={{ fill: theme => theme.vars.palette.primary.main }} />
    </Box>
  );
}

// Mark and wordmark together, as in the sidebar.
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'text.primary', minWidth: 0 }}>
      <BrandMark size={22} />
      {!compact && (
        <Typography component="span" sx={{ fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.04em', lineHeight: 1 }}>
          PricePulse
        </Typography>
      )}
    </Box>
  );
}
