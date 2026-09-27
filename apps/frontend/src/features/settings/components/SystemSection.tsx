import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { formatDistanceStrict } from 'date-fns';
import { Detail, DetailList } from '../../../components/common/DetailList';
import { SectionCard } from '../../../components/common/SectionCard';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { monospace } from '../../../theme/theme';
import { useHealth } from '../hooks/useSystem';

// GET /api/health answers 200 whenever the server is up and reports the database inside. A free Render instance
// that is asleep takes up to a minute to answer, which shows as "Checking".
export function SystemSection() {
  const health = useHealth();
  const status = health.isFetching ? 'checking' : health.isError ? 'unavailable' : 'connected';
  const data = health.isError ? undefined : health.data;

  return (
    <SectionCard
      title="System"
      description="The API this app talks to, asked directly."
      action={
        <Button size="small" startIcon={<RefreshOutlined />} onClick={() => health.refetch()} disabled={health.isFetching}>
          Check again
        </Button>
      }
    >
      <DetailList>
        <Detail label="Backend">
          <Box component="span" role="status" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <StatusBadge status={status} />
            {status === 'unavailable' && (
              <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                {health.error?.message}
              </Typography>
            )}
          </Box>
        </Detail>
        <Detail label="Database">
          {data ? (data.database.status === 'ok' ? `Connected · ${data.database.migrations.length} migrations applied` : 'Unavailable') : '—'}
        </Detail>
        <Detail label="Server uptime">{data ? formatDistanceStrict(0, data.uptimeSeconds * 1000) : '—'}</Detail>
        <Detail label="API URL">
          <Box component="span" sx={monospace}>
            {import.meta.env.VITE_API_URL ?? 'Not configured'}
          </Box>
        </Detail>
        <Detail label="Application">
          Version {__APP_VERSION__}
          {__APP_COMMIT__ && (
            <Box component="span" sx={{ ...monospace, color: 'text.secondary', ml: 1 }}>
              {__APP_COMMIT__}
            </Box>
          )}
        </Detail>
      </DetailList>
    </SectionCard>
  );
}
