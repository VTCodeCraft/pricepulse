import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import { useColorScheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useMatches } from 'react-router-dom';

type Crumb = { title: string; pathname: string };

function hasTitle(handle: unknown): handle is { title: string } {
  return typeof handle === 'object' && handle !== null && typeof (handle as { title?: unknown }).title === 'string';
}

export function Header({ onOpenNavigation }: { onOpenNavigation: () => void }) {
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
        <ThemeToggle />
      </Toolbar>
    </AppBar>
  );
}

function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  if (!mode) return null; // not known until the first client render
  const isDark = (mode === 'system' ? systemMode : mode) === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <Tooltip title={label}>
      <IconButton onClick={() => setMode(isDark ? 'light' : 'dark')} aria-label={label}>
        {isDark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
