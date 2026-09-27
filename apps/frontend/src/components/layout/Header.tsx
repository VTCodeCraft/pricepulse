import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useMatches } from 'react-router-dom';
import { useThemeToggle } from '../../theme/useThemeToggle';

type Crumb = { title: string; pathname: string };

const SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K';

function hasTitle(handle: unknown): handle is { title: string } {
  return typeof handle === 'object' && handle !== null && typeof (handle as { title?: unknown }).title === 'string';
}

export function Header({ onOpenNavigation, onOpenCommands }: { onOpenNavigation: () => void; onOpenCommands: () => void }) {
  const crumbs: Crumb[] = useMatches().flatMap(match => (hasTitle(match.handle) ? [{ title: match.handle.title, pathname: match.pathname }] : []));

  return (
    <AppBar
      position="sticky"
      color="transparent"
      sx={theme => ({
        borderBottom: 1,
        borderColor: 'divider',
        backdropFilter: 'blur(8px)',
        bgcolor: `color-mix(in srgb, ${theme.vars.palette.background.default} 85%, transparent)`,
      })}
    >
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3, lg: 4 } }}>
        <IconButton edge="start" onClick={onOpenNavigation} aria-label="Open navigation" sx={{ display: { sm: 'none' } }}>
          <MenuIcon />
        </IconButton>
        <Breadcrumbs aria-label="Breadcrumb" sx={{ minWidth: 0, '& ol': { flexWrap: 'nowrap' } }}>
          {crumbs.map((crumb, index) =>
            index === crumbs.length - 1 ? (
              <Typography key={crumb.pathname} aria-current="page" noWrap sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.875rem' }}>
                {crumb.title}
              </Typography>
            ) : (
              <Link key={crumb.pathname} component={RouterLink} to={crumb.pathname} underline="hover" color="text.secondary" noWrap sx={{ fontSize: '0.875rem' }}>
                {crumb.title}
              </Link>
            ),
          )}
        </Breadcrumbs>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          onClick={onOpenCommands}
          aria-keyshortcuts="Control+K Meta+K"
          startIcon={<SearchOutlined fontSize="small" />}
          sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'text.secondary', border: 1, borderColor: 'divider', fontWeight: 500, flexShrink: 0 }}
        >
          Commands
          <Box component="kbd" sx={{ ml: 1.5, px: 0.75, borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'inherit', fontSize: '0.75rem' }}>
            {SHORTCUT}
          </Box>
        </Button>
        <IconButton onClick={onOpenCommands} aria-label="Commands" aria-keyshortcuts="Control+K Meta+K" sx={{ display: { sm: 'none' } }}>
          <SearchOutlined fontSize="small" />
        </IconButton>
        <ThemeToggle />
      </Toolbar>
    </AppBar>
  );
}

function ThemeToggle() {
  const { ready, isDark, toggle } = useThemeToggle();
  if (!ready) return null;
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <Tooltip title={label}>
      <IconButton onClick={toggle} aria-label={label}>
        {isDark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
