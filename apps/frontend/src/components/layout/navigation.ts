import type { SvgIconComponent } from '@mui/icons-material';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';

export type NavItem = { to: string; label: string; icon: SvgIconComponent; end?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: SpaceDashboardOutlined, end: true },
  { to: '/products', label: 'All Products', icon: StorefrontOutlined },
  { to: '/tracked', label: 'Tracked Products', icon: Inventory2Outlined },
  { to: '/analytics', label: 'Analytics', icon: InsightsOutlined },
  { to: '/logs', label: 'Scrape Logs', icon: ReceiptLongOutlined },
  { to: '/settings', label: 'Settings', icon: SettingsOutlined },
];
