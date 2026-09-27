import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { Section } from '../../../components/common/Section';
import { AlertList } from '../../settings/components/AlertList';
import { useAlerts } from '../../settings/hooks/useSystem';

// The latest price drops and returns to stock across the tracked options.
export function RecentAlerts() {
  const alerts = useAlerts();
  const recent = (alerts.data ?? []).filter(alert => alert.type === 'price_drop' || alert.type === 'back_in_stock').slice(0, 5);

  return (
    <Section
      title="Price drops and restocks"
      description="Alerts from the scrape runs, newest first."
      action={
        <Link component={RouterLink} to="/settings" sx={{ fontSize: '0.8125rem', color: 'primary.dark', fontWeight: 500 }}>
          All alerts →
        </Link>
      }
    >
      {alerts.isPending ? (
        Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={40} />)
      ) : recent.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {alerts.isError ? 'The alerts could not be loaded.' : 'No price drop or return to stock has been seen yet.'}
        </Typography>
      ) : (
        <AlertList alerts={recent} />
      )}
    </Section>
  );
}
