import KeyboardDoubleArrowLeft from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRight from '@mui/icons-material/KeyboardDoubleArrowRight';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import type { Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { motion as m } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { eyebrow, monospace, motion } from '../../theme/theme';
import { BrandLockup } from '../common/BrandMark';
import { NAV_ITEMS, type NavItem } from './navigation';

const WIDTH = 236;
const COLLAPSED_WIDTH = 64;

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

// From `md`: a sidebar the user can collapse to icons. `sm` to `md` (tablets): icons only. Below `sm`: a drawer opened from the header.
export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const permanent = useMediaQuery((theme: Theme) => theme.breakpoints.up('sm'));
  const wide = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'));

  if (!permanent) {
    return (
      <Drawer open={mobileOpen} onClose={onMobileClose} slotProps={{ paper: { sx: { width: 264, borderRight: 1, borderColor: 'divider' } } }}>
        <SidebarContent collapsed={false} onNavigate={onMobileClose} />
      </Drawer>
    );
  }

  const iconsOnly = collapsed || !wide;
  const width = iconsOnly ? COLLAPSED_WIDTH : WIDTH;
  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: `width 220ms ${motion.css}`,
        '& .MuiDrawer-paper': { width, overflowX: 'hidden', transition: `width 220ms ${motion.css}`, borderRight: 1, borderColor: 'divider' },
      }}
    >
      <SidebarContent collapsed={iconsOnly} onToggleCollapsed={wide ? onToggleCollapsed : undefined} />
    </Drawer>
  );
}

type SidebarContentProps = { collapsed: boolean; onToggleCollapsed?: () => void; onNavigate?: () => void };

function SidebarContent({ collapsed, onToggleCollapsed, onNavigate }: SidebarContentProps) {
  const { pathname } = useLocation();
  const isActive = ({ to, end }: NavItem) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  const groups = (['Monitor', 'System'] as const).map(group => ({ group, items: NAV_ITEMS.filter(item => item.group === group) }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ height: 56, display: 'flex', alignItems: 'center', px: collapsed ? 0 : 2.5, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <BrandLockup compact={collapsed} />
      </Box>

      <Box component="nav" aria-label="Main" sx={{ px: 1.25, pt: 1.5 }}>
        {groups.map(({ group, items }) => (
          <Box key={group} sx={{ mb: 2.5 }}>
            {collapsed ? (
              <Box sx={{ height: '1px', bgcolor: 'divider', mx: 1.5, mb: 1.5 }} aria-hidden />
            ) : (
              <Typography component="p" sx={{ ...eyebrow, color: 'text.secondary', px: 1.25, mb: 1 }}>
                {group}
              </Typography>
            )}
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.25 }}>
              {items.map(item => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Tooltip title={collapsed ? item.label : ''} placement="right">
                      <Box
                        component={NavLink}
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        aria-label={collapsed ? item.label : undefined}
                        sx={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          height: 34,
                          px: 1.25,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          borderRadius: 1,
                          textDecoration: 'none',
                          fontSize: '0.8125rem',
                          fontWeight: active ? 600 : 500,
                          color: active ? 'text.primary' : 'text.secondary',
                          transition: `color 160ms ${motion.css}, background-color 160ms ${motion.css}`,
                          '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                        }}
                      >
                        {active && (
                          <Box
                            component={m.span}
                            layoutId="nav-active"
                            transition={{ duration: motion.base, ease: motion.ease }}
                            aria-hidden
                            sx={{ position: 'absolute', left: -10, top: 8, bottom: 8, width: 2, borderRadius: 1, bgcolor: 'primary.main' }}
                          />
                        )}
                        <Icon sx={{ fontSize: 18, color: active ? 'primary.main' : 'inherit', flexShrink: 0 }} />
                        {!collapsed && <span>{item.label}</span>}
                      </Box>
                    </Tooltip>
                  </li>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 'auto', px: collapsed ? 0 : 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', borderTop: 1, borderColor: 'divider' }}>
        {!collapsed && (
          <Typography component="span" sx={{ ...monospace, fontSize: '0.6875rem', color: 'text.secondary' }}>
            v{__APP_VERSION__}
          </Typography>
        )}
        {onToggleCollapsed && (
          <IconButton size="small" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <KeyboardDoubleArrowRight sx={{ fontSize: 18 }} /> : <KeyboardDoubleArrowLeft sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
