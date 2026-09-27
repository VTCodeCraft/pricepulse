import type { SvgIconComponent } from '@mui/icons-material';
import Autorenew from '@mui/icons-material/Autorenew';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import CloudDoneOutlined from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import HighlightOff from '@mui/icons-material/HighlightOff';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import RemoveShoppingCartOutlined from '@mui/icons-material/RemoveShoppingCartOutlined';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import Box from '@mui/material/Box';

type Tone = 'success' | 'warning' | 'error' | 'neutral';

// Scrape outcomes (success / retried / failed, or running while unfinished), stock states and API connection states.
// Each has a label and an icon, never colour alone.
const STATUSES = {
  success: { label: 'Success', tone: 'success', icon: CheckCircleOutlineOutlined },
  retried: { label: 'Retried', tone: 'warning', icon: Autorenew },
  failed: { label: 'Failed', tone: 'error', icon: HighlightOff },
  running: { label: 'Running', tone: 'neutral', icon: HourglassEmptyOutlined },
  inStock: { label: 'In stock', tone: 'success', icon: Inventory2Outlined },
  outOfStock: { label: 'Out of stock', tone: 'error', icon: RemoveShoppingCartOutlined },
  unknown: { label: 'Unknown', tone: 'neutral', icon: HelpOutlineOutlined },
  connected: { label: 'Connected', tone: 'success', icon: CloudDoneOutlined },
  unavailable: { label: 'Unavailable', tone: 'error', icon: CloudOffOutlined },
  checking: { label: 'Checking', tone: 'neutral', icon: SyncOutlined },
} satisfies Record<string, { label: string; tone: Tone; icon: SvgIconComponent }>;

export type BadgeStatus = keyof typeof STATUSES;

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const { label, tone, icon: Icon } = STATUSES[status];
  return (
    <Box
      component="span"
      sx={theme => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1.5,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        color: tone === 'neutral' ? 'text.secondary' : `${tone}.main`,
        bgcolor: tone === 'neutral' ? 'action.hover' : `rgba(${theme.vars.palette[tone].mainChannel} / 0.12)`,
      })}
    >
      <Icon sx={{ fontSize: 14 }} aria-hidden />
      {label}
    </Box>
  );
}
