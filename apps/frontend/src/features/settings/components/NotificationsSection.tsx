import InfoOutlined from '@mui/icons-material/InfoOutlined';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { Section } from '../../../components/common/Section';
import { formatDateTime } from '../../../lib/utils/format';
import { useAlerts } from '../hooks/useSystem';

// The API stores and lists alerts (GET /api/alerts), but nothing on the server creates them yet, so there are no
// alert settings to offer. Any alert that does exist is listed as recorded.
export function NotificationsSection() {
  const alerts = useAlerts();

  return (
    <Section layout="aside" title="Notifications" description="Alerts recorded by the server.">
      {alerts.isPending ? (
        <LoadingSkeleton variant="table" rows={2} label="Loading alerts" />
      ) : !alerts.data ? (
        <ErrorState title="Unable to load alerts" message={alerts.error?.message} onRetry={() => alerts.refetch()} />
      ) : alerts.data.length === 0 ? (
        <EmptyState
          icon={NotificationsNoneOutlined}
          title="No alerts"
          description="The server can store price-drop, back-in-stock and store-change alerts, but it does not create them yet. Alerting is coming later."
        />
      ) : (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
          {alerts.data.map(alert => {
            const Icon = alert.severity === 'warning' ? WarningAmberOutlined : InfoOutlined;
            return (
              <Box component="li" key={alert.id} sx={{ display: 'flex', gap: 1.5 }}>
                <Icon fontSize="small" sx={{ color: alert.severity === 'warning' ? 'warning.main' : 'info.main', mt: 0.25 }} aria-hidden />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {alert.title}
                    {alert.readAt === null && (
                      <Typography component="span" variant="caption" sx={{ color: 'primary.main', ml: 1 }}>
                        Unread
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {alert.message}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {alert.severity === 'warning' ? 'Warning' : 'Info'} · {formatDateTime(alert.createdAt)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Section>
  );
}
