import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

type LoadingSkeletonProps = { variant: 'cards' | 'chart' | 'table'; label: string; rows?: number };

export function LoadingSkeleton({ variant, label, rows = 5 }: LoadingSkeletonProps) {
  return (
    <Box role="status" aria-busy="true" aria-label={label}>
      {variant === 'cards' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={112} />
          ))}
        </Box>
      )}
      {variant === 'chart' && <Skeleton variant="rounded" height={320} />}
      {variant === 'table' && (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={44} />
          ))}
        </Box>
      )}
    </Box>
  );
}
