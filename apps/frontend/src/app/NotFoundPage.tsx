import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../components/common/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={SearchOffOutlined}
      title="Page not found"
      description="The page you asked for does not exist."
      action={
        <Button component={RouterLink} to="/" variant="contained">
          Back to dashboard
        </Button>
      }
    />
  );
}
