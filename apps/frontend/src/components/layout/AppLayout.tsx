import Box from '@mui/material/Box';
import { motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion as tokens } from '../../theme/theme';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const COLLAPSED_KEY = 'pricepulse.sidebarCollapsed';

// Loaded on first use, so its actions (CSV export, the tracking dialog) add nothing to the first page load.
const CommandPalette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })));

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [paletteLoaded, setPaletteLoaded] = useState(false);

  const setCommands = (open: boolean) => {
    if (open) setPaletteLoaded(true);
    setCommandsOpen(open);
  };

  // Ctrl+K (⌘K on a Mac) toggles the command palette from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteLoaded(true);
        setCommandsOpen(open => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const { pathname } = useLocation();

  const toggleCollapsed = () => {
    localStorage.setItem(COLLAPSED_KEY, String(!collapsed));
    setCollapsed(!collapsed);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 'tooltip',
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 3,
          transform: 'translateY(-200%)',
          '&:focus': { transform: 'none' },
        }}
      >
        Skip to content
      </Box>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={navigationOpen}
        onMobileClose={() => setNavigationOpen(false)}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header onOpenNavigation={() => setNavigationOpen(true)} onOpenCommands={() => setCommands(true)} />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{ flexGrow: 1, width: '100%', maxWidth: 1360, mx: 'auto', px: { xs: 2, sm: 3, lg: 5 }, pt: { xs: 3, md: 4.5 }, pb: { xs: 5, md: 7 }, outline: 'none' }}
        >
          <motion.div key={pathname} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: tokens.base, ease: tokens.ease }}>
            <Suspense fallback={<LoadingSkeleton variant="cards" label="Loading page" />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </Box>
      </Box>
      {paletteLoaded && (
        <Suspense fallback={null}>
          <CommandPalette open={commandsOpen} onOpenChange={setCommands} />
        </Suspense>
      )}
    </Box>
  );
}
