import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { queryClient } from '../lib/query/queryClient';
import { theme } from '../theme/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      <QueryClientProvider client={queryClient}>
        {/* "user" turns every Framer Motion animation off when the OS asks for reduced motion. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { mode, systemMode } = useColorScheme();
  const resolved = mode === 'system' ? systemMode : mode;
  return <Toaster theme={resolved ?? 'system'} position="bottom-right" closeButton richColors />;
}
