import type {} from '@mui/material/themeCssVarsAugmentation';
import type {} from '@mui/x-data-grid/themeAugmentation';
import { createTheme } from '@mui/material/styles';

// The PricePulse design tokens. Black, white and one orange accent (in the range of INE's brand orange), neutral
// grays, hairline borders instead of shadows. Components read colours through the theme (theme.vars.palette.*).
const ORANGE = '#EE5A10';

const light = {
  background: { default: '#FAFAFA', paper: '#FFFFFF' },
  text: { primary: '#111111', secondary: '#62666D' },
  divider: '#E6E6E6',
  // `dark` is the orange used for text on white (link-like accents), where the brand orange is too light to read.
  primary: { main: ORANGE, dark: '#B8440B', contrastText: '#FFFFFF' },
  success: { main: '#1A7F37' },
  warning: { main: '#B45309' },
  error: { main: '#CF222E' },
  info: { main: '#62666D' },
};

const dark = {
  // Near-black, not blue-gray: the page is black, surfaces are charcoal.
  background: { default: '#070707', paper: '#0F0F0F' },
  text: { primary: '#F2F2F2', secondary: '#8E8E8E' },
  divider: '#1F1F1F',
  primary: { main: '#FF6A1F', dark: '#FF8A4C', contrastText: '#0A0A0A' },
  success: { main: '#3FB950' },
  warning: { main: '#E3B341' },
  error: { main: '#F85149' },
  info: { main: '#8E8E8E' },
};

export const fonts = {
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"Geist Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
};

// Codes and raw values: ids, timestamps, SKUs, keyboard shortcuts.
export const monospace = { fontFamily: fonts.mono, fontSize: '0.75rem', letterSpacing: 0 };

// Small uppercase labels over values and sections.
export const eyebrow = { fontFamily: fonts.mono, fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' } as const;

// One easing for everything that moves: fast out, gentle settle.
export const motion = { ease: [0.16, 1, 0.3, 1] as const, css: 'cubic-bezier(0.16, 1, 0.3, 1)', fast: 0.14, base: 0.22 };

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-color-scheme' },
  colorSchemes: { light: { palette: light }, dark: { palette: dark } },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: fonts.sans,
    fontSize: 14,
    h1: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.15 },
    h2: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.3 },
    h3: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontSize: '0.875rem', fontWeight: 600 },
    subtitle1: { fontSize: '0.9375rem', lineHeight: 1.55 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.45 },
    overline: { ...eyebrow, lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0, fontSize: '0.8125rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: theme => ({
        body: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', fontFeatureSettings: '"ss01", "cv11"' },
        '::selection': { background: `rgba(${theme.vars.palette.primary.mainChannel} / 0.25)` },
        ':focus-visible': { outline: `2px solid ${theme.vars.palette.primary.main}`, outlineOffset: 2 },
        '*': { scrollbarWidth: 'thin', scrollbarColor: `${theme.vars.palette.divider} transparent` },
      }),
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 6,
          paddingInline: 14,
          minHeight: 34,
          transition: `background-color 160ms ${motion.css}, border-color 160ms ${motion.css}, color 160ms ${motion.css}, transform 120ms ${motion.css}`,
          '&:active:not(.Mui-disabled)': { transform: 'translateY(1px)' },
          variants: [
            // Primary actions are ink (black on light, white on dark) and turn orange under the pointer.
            {
              props: { variant: 'contained', color: 'primary' },
              style: {
                backgroundColor: theme.vars.palette.text.primary,
                color: theme.vars.palette.background.paper,
                '&:hover': { backgroundColor: theme.vars.palette.primary.main, color: '#FFFFFF' },
              },
            },
            {
              props: { variant: 'outlined', color: 'primary' },
              style: {
                borderColor: theme.vars.palette.divider,
                color: theme.vars.palette.text.primary,
                '&:hover': { borderColor: theme.vars.palette.text.secondary, backgroundColor: theme.vars.palette.action.hover },
              },
            },
            {
              props: { variant: 'text', color: 'primary' },
              style: { color: theme.vars.palette.text.primary, '&:hover': { backgroundColor: theme.vars.palette.action.hover } },
            },
            { props: { size: 'small' }, style: { minHeight: 30, paddingInline: 10, fontSize: '0.8125rem' } },
          ],
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 6,
          color: theme.vars.palette.text.secondary,
          transition: `background-color 160ms ${motion.css}, color 160ms ${motion.css}`,
          '&:hover': { color: theme.vars.palette.text.primary, backgroundColor: theme.vars.palette.action.hover },
        }),
      },
    },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 6,
          backgroundColor: theme.vars.palette.background.paper,
          transition: `box-shadow 160ms ${motion.css}`,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.divider },
          '&:hover:not(.Mui-focused):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.text.secondary },
          '&.Mui-focused': { boxShadow: `0 0 0 3px rgba(${theme.vars.palette.primary.mainChannel} / 0.16)` },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.primary.main, borderWidth: 1 },
        }),
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: ({ theme }) => ({ '&.Mui-focused': { color: theme.vars.palette.text.primary } }) },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 4, fontWeight: 500 }, sizeSmall: { height: 22, fontSize: '0.75rem' } },
    },
    MuiToggleButtonGroup: {
      styleOverrides: { root: ({ theme }) => ({ backgroundColor: theme.vars.palette.background.paper }) },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontFamily: fonts.mono,
          fontSize: '0.75rem',
          fontWeight: 500,
          color: theme.vars.palette.text.secondary,
          borderColor: theme.vars.palette.divider,
          paddingBlock: 4,
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: theme.vars.palette.text.primary, color: theme.vars.palette.background.paper },
        }),
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: false, enterDelay: 250 },
      styleOverrides: {
        tooltip: ({ theme }) => ({
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: 4,
          padding: '4px 8px',
          backgroundColor: theme.vars.palette.text.primary,
          color: theme.vars.palette.background.paper,
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({ borderRadius: 10, border: `1px solid ${theme.vars.palette.divider}`, boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)' }),
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { variants: [{ props: { invisible: false }, style: { backgroundColor: 'rgba(0, 0, 0, 0.45)' } }] } },
    },
    MuiDrawer: {
      styleOverrides: { paper: ({ theme }) => ({ borderColor: theme.vars.palette.divider, backgroundColor: theme.vars.palette.background.default }) },
    },
    MuiPopover: {
      styleOverrides: { paper: ({ theme }) => ({ border: `1px solid ${theme.vars.palette.divider}`, boxShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.18)' }) },
    },
    MuiMenuItem: { styleOverrides: { root: { fontSize: '0.8125rem', borderRadius: 4, marginInline: 4 } } },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }) => ({ borderRadius: 6, border: `1px solid ${theme.vars.palette.divider}`, fontSize: '0.8125rem', alignItems: 'center' }),
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: ({ theme }) => ({ backgroundColor: theme.vars.palette.action.hover }), rounded: { borderRadius: 6 } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: ({ theme }) => ({ height: 2, backgroundColor: theme.vars.palette.divider }) },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 6,
          fontFamily: fonts.mono,
          fontSize: '0.75rem',
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: theme.vars.palette.text.primary, color: theme.vars.palette.background.paper },
        }),
      },
    },
    MuiStepIcon: {
      styleOverrides: { text: { fontFamily: fonts.mono, fontWeight: 600 } },
    },
    MuiLink: { defaultProps: { underline: 'hover' } },
    MuiDataGrid: {
      defaultProps: { rowHeight: 52, columnHeaderHeight: 40, disableColumnMenu: true },
      styleOverrides: {
        root: ({ theme }) => ({
          border: 0,
          '--DataGrid-containerBackground': 'transparent',
          '--DataGrid-rowBorderColor': theme.vars.palette.divider,
          fontSize: '0.8125rem',
          '& .MuiDataGrid-columnHeaderTitle': { ...eyebrow, color: theme.vars.palette.text.secondary },
          '& .MuiDataGrid-columnSeparator': { display: 'none' },
          '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', lineHeight: 1.43 },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
            outline: `2px solid ${theme.vars.palette.primary.main}`,
            outlineOffset: -2,
          },
          '& .MuiDataGrid-row:hover': { backgroundColor: theme.vars.palette.action.hover },
          '& .MuiDataGrid-footerContainer': { borderTopColor: theme.vars.palette.divider },
        }),
      },
    },
  },
});
