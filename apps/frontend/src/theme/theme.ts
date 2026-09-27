import type {} from '@mui/material/themeCssVarsAugmentation';
import { createTheme } from '@mui/material/styles';

// Every colour the app uses. Components read them through the theme (theme.vars.palette.*), never as literals.
const light = {
  background: { default: '#F8FAFC', paper: '#FFFFFF' },
  text: { primary: '#0F172A', secondary: '#64748B' },
  divider: '#E2E8F0',
  primary: { main: '#2563EB' },
  secondary: { main: '#7C3AED' },
  success: { main: '#16A34A' },
  warning: { main: '#F59E0B' },
  error: { main: '#DC2626' },
};

const dark = {
  background: { default: '#0B1120', paper: '#111827' },
  text: { primary: '#F8FAFC', secondary: '#94A3B8' },
  divider: '#1F2937',
  primary: { main: '#3B82F6' },
  secondary: { main: '#8B5CF6' },
  // Lighter than the light-scheme values so status text stays readable on the dark surface.
  success: { main: '#22C55E' },
  warning: { main: '#FBBF24' },
  error: { main: '#F87171' },
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-color-scheme' },
  colorSchemes: { light: { palette: light }, dark: { palette: dark } },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    h1: { fontSize: '1.625rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25 },
    h2: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontSize: '0.9375rem', fontWeight: 600 },
    subtitle1: { fontSize: '0.9375rem', lineHeight: 1.5 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
    body2: { fontSize: '0.8125rem' },
    caption: { fontSize: '0.75rem' },
    overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased', fontFeatureSettings: '"cv11", "ss01"' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 14 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, paddingInline: 14 } },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: { tooltip: { fontSize: '0.75rem' } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 16 } },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } },
    },
  },
});

// Codes and raw values (error codes, URLs, UTC timestamps).
export const monospace = { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '0.75rem' };
