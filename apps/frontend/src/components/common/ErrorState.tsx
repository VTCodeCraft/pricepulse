import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import Refresh from '@mui/icons-material/Refresh';
import Button from '@mui/material/Button';
import { EmptyState } from './EmptyState';

type ErrorStateProps = { title: string; message?: string; onRetry?: () => void };

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      tone="error"
      icon={ErrorOutlineOutlined}
      title={title}
      description={message}
      action={
        onRetry && (
          <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
