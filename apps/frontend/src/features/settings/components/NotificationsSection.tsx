import DoneAllOutlined from '@mui/icons-material/DoneAllOutlined';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import Button from '@mui/material/Button';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { Section } from '../../../components/common/Section';
import { useAlerts, useMarkAllAlertsRead } from '../hooks/useSystem';
import { AlertList } from './AlertList';

// In-app alerts recorded by the server's scrape runs. No email is sent.
export function NotificationsSection() {
  const alerts = useAlerts();
  const markAllRead = useMarkAllAlertsRead();
  const unread = alerts.data?.filter(alert => alert.readAt === null).length ?? 0;

  return (
    <Section
      layout="aside"
      title="Alerts"
      description="Recorded by the scrape runs: a lower price than the previous validated one, a return to stock, or a change in the store's price panel structure. Shown here only; no email is sent."
      action={
        unread > 0 && (
          <Button size="small" variant="outlined" startIcon={<DoneAllOutlined />} loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            Mark {unread} as read
          </Button>
        )
      }
    >
      {alerts.isPending ? (
        <LoadingSkeleton variant="table" rows={2} label="Loading alerts" />
      ) : !alerts.data ? (
        <ErrorState title="Unable to load alerts" message={alerts.error?.message} onRetry={() => alerts.refetch()} />
      ) : alerts.data.length === 0 ? (
        <EmptyState
          icon={NotificationsNoneOutlined}
          title="No alerts yet"
          description="An alert appears when a scheduled or manual scrape finds a price drop, a return to stock or a changed page structure."
        />
      ) : (
        <AlertList alerts={alerts.data} />
      )}
    </Section>
  );
}
