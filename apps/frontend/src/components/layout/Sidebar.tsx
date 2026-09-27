import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import type { Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navigation';

const WIDTH = 248;
const COLLAPSED_WIDTH = 72;

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
      <Drawer open={mobileOpen} onClose={onMobileClose} slotProps={{ paper: { sx: { width: WIDTH } } }}>
        <SidebarContent collapsed={false} onNavigate={onMobileClose} />
      </Drawer>
    );
  }

  const iconsOnly = collapsed || !wide;
  const width = iconsOnly ? COLLAPSED_WIDTH : WIDTH;
  return (
    <Drawer
      variant="permanent"
      sx={theme => ({
        width,
        flexShrink: 0,
        transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
        '& .MuiDrawer-paper': {
          width,
          overflowX: 'hidden',
          transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
        },
      })}
    >
      <SidebarContent collapsed={iconsOnly} onToggleCollapsed={wide ? onToggleCollapsed : undefined} />
    </Drawer>
  );
}

type SidebarContentProps = { collapsed: boolean; onToggleCollapsed?: () => void; onNavigate?: () => void };

function SidebarContent({ collapsed, onToggleCollapsed, onNavigate }: SidebarContentProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 1.5, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, height: 36, mb: 3 }}>
        <BrandMark />
        {!collapsed && (
          <Typography component="span" sx={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
            PricePulse
          </Typography>
        )}
      </Box>

      <Box component="nav" aria-label="Main">
        <List disablePadding sx={{ display: 'grid', gap: 0.5 }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <Tooltip key={to} title={collapsed ? label : ''} placement="right">
              <ListItemButton
                component={NavLink}
                to={to}
                end={end}
                onClick={onNavigate}
                aria-label={collapsed ? label : undefined}
                sx={theme => ({
                  minHeight: 40,
                  px: 1.25,
                  color: 'text.secondary',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  '&.active': {
                    color: 'primary.main',
                    bgcolor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.1)`,
                  },
                })}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 1.5, color: 'inherit' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 500 } } }} />
                )}
              </ListItemButton>
            </Tooltip>
          ))}
        </List>
      </Box>

      {onToggleCollapsed && (
        <Box sx={{ mt: 'auto', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <IconButton size="small" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
          </IconButton>
        </Box>
      )}
    </Box>
  );
}

function BrandMark() {
  return (
    <Box
      component="svg"
      viewBox="0 0 32 32"
      aria-hidden
      sx={{ width: 28, height: 28, flexShrink: 0, color: 'primary.main' }}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <Box
        component="path"
        d="M6 17h5l2.5-6 4 11 3-8H26"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        sx={{ stroke: theme => theme.vars.palette.primary.contrastText }}
      />
    </Box>
  );
}
