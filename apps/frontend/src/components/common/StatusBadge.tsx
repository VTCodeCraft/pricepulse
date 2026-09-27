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
import TrendingDownOutlined from '@mui/icons-material/TrendingDownOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';

type Tone = 'success' | 'warning' | 'error' | 'neutral';

// Scrape outcomes (success / retried / failed, or running while unfinished), stock states, API connection states,
// alert types and the store page-structure state.
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
  priceDrop: { label: 'Price drop', tone: 'success', icon: TrendingDownOutlined },
  backInStock: { label: 'Back in stock', tone: 'success', icon: Inventory2Outlined },
  structureChanged: { label: 'Changed', tone: 'warning', icon: WarningAmberOutlined },
  structureUnchanged: { label: 'Unchanged', tone: 'success', icon: CheckCircleOutlineOutlined },
} satisfies Record<string, { label: string; tone: Tone; icon: SvgIconComponent }>;

export type BadgeStatus = keyof typeof STATUSES;

// A small outlined label: icon and text in the state's colour, a faint tint behind. Never colour alone.
export function StatusBadge({ status }: { status: BadgeStatus }) {
  const { label, tone, icon: Icon } = STATUSES[status];
  return (
    <Box
      component="span"
      sx={theme => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        height: 22,
        px: 0.75,
        borderRadius: 0.5,
        border: 1,
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: tone === 'neutral' ? 'text.secondary' : `${tone}.main`,
        borderColor: tone === 'neutral' ? 'divider' : `rgba(${theme.vars.palette[tone].mainChannel} / 0.35)`,
        bgcolor: tone === 'neutral' ? 'transparent' : `rgba(${theme.vars.palette[tone].mainChannel} / 0.06)`,
      })}
    >
      <Icon sx={{ fontSize: 13 }} aria-hidden />
      {label}
    </Box>
  );
}
