import { useColorScheme } from '@mui/material/styles';

// Light/dark switch on top of MUI's colour-scheme state (which also stores the choice); used by the header and the
// command palette. `ready` is false until the first client render knows the mode.
export function useThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const isDark = (mode === 'system' ? systemMode : mode) === 'dark';
  return { ready: Boolean(mode), isDark, toggle: () => setMode(isDark ? 'light' : 'dark') };
}
