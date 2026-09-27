import Box from '@mui/material/Box';
import { motion } from 'framer-motion';
import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const COLLAPSED_KEY = 'pricepulse.sidebarCollapsed';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
  const [navigationOpen, setNavigationOpen] = useState(false);
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
        <Header onOpenNavigation={() => setNavigationOpen(true)} />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{ flexGrow: 1, width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 }, outline: 'none' }}
        >
          <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
            <Suspense fallback={<LoadingSkeleton variant="cards" label="Loading page" />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
}
