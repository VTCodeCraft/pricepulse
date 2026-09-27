import { useColorScheme } from '@mui/material/styles';
import type { MouseEvent } from 'react';
import { flushSync } from 'react-dom';

type Mode = 'light' | 'dark' | 'system';

// Where a click came from, so the new theme can grow out of the control that was pressed.
export const originOf = (event: MouseEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

// Light / dark / system on top of MUI's colour-scheme state (which also stores the choice). A change is revealed as a
// circle from `origin` with the View Transitions API; it is instant without the API or with reduced motion.
export function useThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'light';
  const isDark = resolved === 'dark';

  const changeMode = (next: Mode, origin?: { x: number; y: number }) => {
    const nextResolved = next === 'system' ? (systemMode ?? resolved) : next;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduceMotion || nextResolved === resolved) {
      setMode(next);
      return;
    }
    const root = document.documentElement;
    root.style.setProperty('--theme-x', origin ? `${origin.x}px` : '50%');
    root.style.setProperty('--theme-y', origin ? `${origin.y}px` : '50%');
    const transition = document.startViewTransition(() => {
      flushSync(() => setMode(next));
      root.setAttribute('data-color-scheme', nextResolved); // MUI sets the same attribute in an effect; the snapshot needs it now
    });
    // The browser may skip or abort the animation (a hidden or busy page); the theme still changes, so that is not an error.
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
  };

  return {
    ready: Boolean(mode),
    mode,
    isDark,
    changeMode,
    toggle: (origin?: { x: number; y: number }) => changeMode(isDark ? 'light' : 'dark', origin),
  };
}
