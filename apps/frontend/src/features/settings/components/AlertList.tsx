import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { StatusBadge, type BadgeStatus } from '../../../components/common/StatusBadge';
import { formatPrice, formatRelativeTime, formatSignedPercent, formatTimestamp } from '../../../lib/utils/format';
import { monospace } from '../../../theme/theme';
import type { Alert, ObservationAlertData } from '../../../types/system';
import { productPath } from '../../products/productInfo';

const BADGES: Record<Alert['type'], BadgeStatus> = {
  price_drop: 'priceDrop',
  back_in_stock: 'backInStock',
  structure_changed: 'structureChanged',
  store_app_updated: 'unknown',
};

// Alerts as the server recorded them, newest first: what changed, for which option, and when.
export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {alerts.map(alert => (
        <Box
          component="li"
          key={alert.id}
          sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', columnGap: 2, rowGap: 0.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <AlertSubject alert={alert} />
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
              <AlertChange alert={alert} />
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <StatusBadge status={BADGES[alert.type]} />
            <Tooltip title={formatTimestamp(alert.createdAt)}>
              <Typography component="span" sx={{ ...monospace, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {alert.readAt === null && (
                  <Box component="span" aria-label="Unread" sx={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', mr: 0.75, verticalAlign: 'middle' }} />
                )}
                {formatRelativeTime(alert.createdAt)}
              </Typography>
            </Tooltip>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function observationData(alert: Alert): ObservationAlertData | null {
  return alert.type === 'price_drop' || alert.type === 'back_in_stock' ? (alert.data as ObservationAlertData | null) : null;
}

function AlertSubject({ alert }: { alert: Alert }) {
  const data = observationData(alert);
  if (!data) {
    return (
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {alert.title}
      </Typography>
    );
  }
  return (
    <Link component={RouterLink} to={productPath(data.storeProductId, data.optionId)} variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
      {data.productName} · {data.optionLabel}
    </Link>
  );
}

function AlertChange({ alert }: { alert: Alert }) {
  const data = observationData(alert);
  if (alert.type === 'price_drop' && data?.previousPrice != null && data.currentPrice != null) {
    return (
      <>
        {formatPrice(data.previousPrice, data.currency)} → {formatPrice(data.currentPrice, data.currency)}
        {data.changePct != null && ` · ${formatSignedPercent(data.changePct)}`}
      </>
    );
  }
  if (alert.type === 'back_in_stock' && data?.currentStock != null) return <>Out of stock → {data.currentStock} available</>;
  return <>{alert.message}</>;
}
