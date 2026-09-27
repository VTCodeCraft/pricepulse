import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

type LoadingSkeletonProps = { variant: 'cards' | 'chart' | 'table'; label: string; rows?: number };

// Placeholders shaped like what is loading: the metrics strip, a chart, or table rows.
export function LoadingSkeleton({ variant, label, rows = 5 }: LoadingSkeletonProps) {
  return (
    <Box role="status" aria-busy="true" aria-label={label}>
      {variant === 'cards' && (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 3 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Box key={i}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="55%" height={36} />
              <Skeleton width="70%" height={14} />
            </Box>
          ))}
        </Box>
      )}
      {variant === 'chart' && <Skeleton variant="rounded" height={280} />}
      {variant === 'table' && (
        <Box sx={{ display: 'grid' }}>
          {Array.from({ length: rows }, (_, i) => (
            <Box key={i} sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 3 }}>
              <Skeleton width="30%" height={18} />
              <Skeleton width="15%" height={18} />
              <Skeleton width="20%" height={18} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
