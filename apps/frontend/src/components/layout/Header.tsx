import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AnimatePresence, motion as m } from 'framer-motion';
import { Link as RouterLink, useMatches } from 'react-router-dom';
import { monospace, motion } from '../../theme/theme';
import { originOf, useThemeToggle } from '../../theme/useThemeToggle';
import { BrandMark } from '../common/BrandMark';

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
        bgcolor: `color-mix(in srgb, ${theme.vars.palette.background.default} 88%, transparent)`,
      })}
    >
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 56 }, px: { xs: 1.5, sm: 3, lg: 4 } }}>
        <IconButton edge="start" onClick={onOpenNavigation} aria-label="Open navigation" sx={{ display: { sm: 'none' } }}>
          <MenuIcon fontSize="small" />
        </IconButton>
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, color: 'text.primary', mr: 0.5 }}>
          <BrandMark size={20} />
        </Box>
        <Breadcrumbs aria-label="Breadcrumb" separator="/" sx={{ minWidth: 0, fontSize: '0.8125rem', '& ol': { flexWrap: 'nowrap' }, '& .MuiBreadcrumbs-separator': { color: 'divider', mx: 1 } }}>
          {crumbs.map((crumb, index) =>
            index === crumbs.length - 1 ? (
              <Typography key={crumb.pathname} aria-current="page" noWrap sx={{ fontWeight: 600, color: 'text.primary', fontSize: 'inherit' }}>
                {crumb.title}
              </Typography>
            ) : (
              <Link key={crumb.pathname} component={RouterLink} to={crumb.pathname} color="text.secondary" noWrap sx={{ fontSize: 'inherit' }}>
                {crumb.title}
              </Link>
            ),
          )}
        </Breadcrumbs>
        <Box sx={{ flexGrow: 1 }} />
        <Box
          component="button"
          type="button"
          onClick={onOpenCommands}
          aria-keyshortcuts="Control+K Meta+K"
          sx={theme => ({
            display: { xs: 'none', sm: 'inline-flex' },
            alignItems: 'center',
            gap: 1,
            height: 32,
            pl: 1,
            pr: 0.75,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            color: 'text.secondary',
            font: 'inherit',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            transition: `border-color 160ms ${motion.css}, color 160ms ${motion.css}`,
            '&:hover': { borderColor: theme.vars.palette.text.secondary, color: 'text.primary' },
          })}
        >
          <SearchOutlined sx={{ fontSize: 16 }} />
          <span>Commands</span>
          <Box component="kbd" sx={{ ...monospace, fontSize: '0.6875rem', px: 0.75, py: 0.125, ml: 1.5, border: 1, borderColor: 'divider', borderRadius: 0.5 }}>
            {SHORTCUT}
          </Box>
        </Box>
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
      <IconButton onClick={event => toggle(originOf(event))} aria-label={label}>
        <AnimatePresence mode="wait" initial={false}>
          <Box
            component={m.span}
            key={isDark ? 'dark' : 'light'}
            initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
            transition={{ duration: motion.fast, ease: motion.ease }}
            sx={{ display: 'grid', placeItems: 'center' }}
          >
            {isDark ? <LightModeOutlined sx={{ fontSize: 18 }} /> : <DarkModeOutlined sx={{ fontSize: 18 }} />}
          </Box>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
}
