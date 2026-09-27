import type { SvgIconComponent } from '@mui/icons-material';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';

export type NavItem = { to: string; label: string; icon: SvgIconComponent; group: 'Monitor' | 'System'; end?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: SpaceDashboardOutlined, group: 'Monitor', end: true },
  { to: '/tracked', label: 'Tracked Products', icon: Inventory2Outlined, group: 'Monitor' },
  { to: '/products', label: 'All Products', icon: StorefrontOutlined, group: 'Monitor' },
  { to: '/analytics', label: 'Analytics', icon: InsightsOutlined, group: 'Monitor' },
  { to: '/logs', label: 'Scrape Logs', icon: ReceiptLongOutlined, group: 'Monitor' },
  { to: '/settings', label: 'Settings', icon: SettingsOutlined, group: 'System' },
];
