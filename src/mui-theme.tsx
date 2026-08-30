declare module '@mui/material/styles' {
  interface TypographyVariants {
    h7: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    h7?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    h7: true;
  }
}

import { createTheme } from '@mui/material/styles';
import type { Theme, PaletteMode } from '@mui/material/styles';
import type { CSSObject } from '@emotion/react';

// GSC Brand Colors:
// Primary:   Aqua #00ABBB | Peach #F6AB84 | Citrus #FBB114
// Secondary: Teal #008194 | Burnt Orange #EF864C | Off White #F4F1E9 | Deep Gray #3B3838 | Bright Yellow #FFF34A (gradients only)
//
// Brand hues (primary/secondary/error/warning/info/success) stay the same in
// both modes - only the neutrals (background, text, dividers, surface
// borders/shadows baked into component overrides below) flip. Dark mode's
// neutrals are warm, not blue-black, to stay in the same family as the
// brand's own Deep Gray/Off White pair rather than reaching for a generic
// slate palette.
const NEUTRAL = {
  light: {
    bgDefault: '#F4F1E9',   // GSC Off White
    bgPaper: '#FFFFFF',
    surfaceAlt: '#F9FAFB',  // subtle info-card tint, e.g. windrose panels
    textPrimary: '#3B3838', // GSC Deep Gray
    textSecondary: '#6B7280',
    textDisabled: '#9CA3AF',
    divider: '#E5E7EB',
    border: '#e6e6e6',
    borderSubtle: '#f0f0f0',
    tooltipBg: '#FFFFFF',
    railBg: '#f6f8f9',
    railBorder: '#e9f1f2',
  },
  dark: {
    bgDefault: '#171D1E',
    bgPaper: '#20272A',
    surfaceAlt: '#263033',
    textPrimary: '#F4F1E9', // GSC Off White, swapped in as dark mode's primary text
    textSecondary: '#B8C0C2',
    textDisabled: '#748083',
    divider: 'rgba(244,241,233,0.12)',
    border: 'rgba(244,241,233,0.16)',
    borderSubtle: 'rgba(244,241,233,0.08)',
    tooltipBg: '#2B3336',
    railBg: '#1B2224',
    railBorder: 'rgba(244,241,233,0.1)',
  },
} as const;

/**
 * Builds the app's MUI theme for a given mode. Called once per mode change
 * (see ThemedApp in main.tsx, which memoises on `mode`) rather than kept as
 * a single static theme - dark mode needs its own neutrals throughout the
 * component overrides below, not just the top-level palette.
 */
export function getTheme(mode: PaletteMode = 'light'): Theme {
  const n = mode === 'dark' ? NEUTRAL.dark : NEUTRAL.light;
  // GSC Teal (#008194) is the same colour every one of these literals below
  // used to hardcode - see the note on palette.primary.dark for why it
  // swaps to a plain grey text tone in dark mode instead.
  const TEAL_ACCENT = mode === 'dark' ? n.textSecondary : '#008194';
  // GSC Aqua (#00ABBB) used as a solid FILL (a button, a selected tab/toggle
  // pill, a chip) rather than as text/border/accent - a slate grey instead
  // in dark mode, same reasoning as TEAL_ACCENT above but a fill needs a
  // colour with enough weight to still read as "filled" against the dark
  // page background, not the lighter text-secondary tone TEAL_ACCENT uses.
  // Badge is the one deliberate exception - it keeps aqua in both modes.
  const FILL_ACCENT = mode === 'dark' ? '#4B5563' : '#00ABBB';
  // GSC Aqua used as TEXT/border/icon (not a fill) - collapses to the same
  // grey as TEAL_ACCENT in dark mode (aqua-as-text has the identical
  // low-contrast problem teal-as-text did), but - unlike TEAL_ACCENT -
  // stays AQUA in light mode rather than teal, since these spots were aqua
  // before dark mode existed and light mode isn't changing.
  const AQUA_TEXT = mode === 'dark' ? TEAL_ACCENT : '#00ABBB';
  const FILL_ACCENT_TINT = mode === 'dark' ? 'rgba(75,85,99,0.35)' : 'rgba(0,171,187,0.12)';
  const FILL_ACCENT_TINT_HOVER = mode === 'dark' ? 'rgba(75,85,99,0.5)' : 'rgba(0,171,187,0.2)';

  return createTheme({
  palette: {
    mode,
    primary: {
      // GSC Aqua in light mode. In dark mode this collapses to the same
      // grey as primary.dark below - aqua-as-text (Compare, windrose
      // labels, the "Solar Policy Explorer" wordmark, active nav links,
      // unselected tab text, borders) reads the same way teal did: fine on
      // white, low-contrast/muddy on a dark surface. Aqua survives in dark
      // mode only where a component explicitly opts back in with a literal
      // hex rather than this token - currently just Badge, on purpose.
      main: mode === 'dark' ? TEAL_ACCENT : '#00ABBB',
      light: '#5FCCD8',
      // GSC Teal in light mode - it's the darker of the two accent colours,
      // used as an accent-heading text colour throughout (Help, Admin
      // console, ImpactList, windrose card titles). That relationship
      // inverts on a dark background: teal reads as muddy/low-contrast
      // there, so dark mode swaps it for a plain light grey text tone
      // instead - still reads as "the accent-heading colour", not primary
      // body text.
      dark: TEAL_ACCENT,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FBB114',        // GSC Citrus
      light: '#FCCA4A',
      dark: '#D4960F',
      contrastText: '#3B3838', // Citrus is bright - dark text for contrast
    },
    error: {
      main: '#E24B4A',
      light: '#f07070',
      dark: '#a32d2d',
    },
    warning: {
      main: '#EF864C',        // GSC Burnt Orange
      light: '#F3A07A',
      dark: '#C86C38',
    },
    info: {
      main: '#00ABBB',        // GSC Aqua
      light: '#5FCCD8',
      dark: TEAL_ACCENT,       // GSC Teal
    },
    success: {
      main: '#1D9E75',
      light: '#52be80',
      dark: '#157a5a',
    },
    grey: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    text: {
      primary: n.textPrimary,
      secondary: n.textSecondary,
      disabled: n.textDisabled,
    },
    background: {
      default: n.bgDefault,
      paper: n.bgPaper,
    },
    divider: n.divider,
  },

  typography: {
    fontFamily: [
      'Eastman Grotesque',
      '-apple-system',
      'BlinkMacSystemFont',
      'sans-serif',
    ].join(','),

    h1: {
      fontSize: '1.75rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: n.textPrimary,
    },
    h2: {
      fontSize: '1.375rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: n.textPrimary,
    },
    h3: {
      fontSize: '1rem',
      fontWeight: 500,
      color: n.textPrimary,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: AQUA_TEXT,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: n.textPrimary,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      color: AQUA_TEXT,
    },
    h7: {
      fontSize: '1rem',
      fontWeight: 600,
      color: n.textPrimary,
    },
    subtitle1: {
      fontSize: '0.875rem',
      fontWeight: 500,
      color: n.textPrimary,
    },
    subtitle2: {
      fontSize: '0.8125rem',
      fontWeight: 500,
      color: n.textSecondary,
    },
    body1: {
      fontSize: '0.875rem',
      color: n.textPrimary,
    },
    body2: {
      fontSize: '0.8125rem',
      color: n.textSecondary,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.6875rem',
      color: n.textSecondary,
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: n.textSecondary,
    },
  },

  shape: {
    borderRadius: 8,
  },

  shadows: [
    'none',
    '0 1px 4px rgba(0,0,0,0.06)',
    '0 2px 6px rgba(0,0,0,0.08)',
    '0 2px 8px rgba(0,0,0,0.08)',
    '0 4px 12px rgba(0,0,0,0.12)',
    '0 6px 18px rgba(10,20,25,0.06)',
    '0 6px 20px rgba(0,0,0,0.08)',
    '0 8px 20px rgba(0,0,0,0.12)',
    '0 6px 18px rgba(59,56,56,0.12)',
    '-2px 0 8px rgba(0,0,0,0.1)',
    '-6px 0 28px rgba(9,20,26,0.06)',
    '0 4px 16px rgba(0,0,0,0.08)',
    'inset 0 -2px 0 rgba(0,0,0,0.03)',
    'inset 0 -2px 0 rgba(0,0,0,0.06)',
    '0 0 0 3px rgba(0,171,187,0.12)',
    '0 0 0 3px rgba(0,129,148,0.12)',
    '0 1px 2px rgba(0,0,0,0.06)',
    '0 2px 8px rgba(0,0,0,0.12)',
    '0 4px 12px rgba(0,0,0,0.12)',
    '0 8px 20px rgba(0,0,0,0.12)',
    'inset 0 1px 3px rgba(0,0,0,0.1)',
    '0 12px 24px rgba(0,0,0,0.15)',
    '0 16px 32px rgba(0,0,0,0.18)',
    '0 20px 40px rgba(0,0,0,0.2)',
    '0 24px 48px rgba(0,0,0,0.22)',
  ],

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 600,
          fontSize: '0.8125rem',
          textTransform: 'none',
          transition: 'all 0.18s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          },
        },
        contained: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          },
        },
        containedPrimary: {
          backgroundColor: FILL_ACCENT,
          color: '#ffffff',
          '&:hover': {
            backgroundColor: TEAL_ACCENT,
          },
        },
        outlined: {
          border: `1px solid ${n.border}`,
          '&:hover': {
            border: '1px solid #00ABBB',
            backgroundColor: 'rgba(0,171,187,0.04)',
          },
        },
        text: {
          color: AQUA_TEXT,
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.08)',
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: n.bgPaper,
          borderRadius: 8,
          padding: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: `1px solid ${n.borderSubtle}`,
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: n.bgPaper,
          borderRadius: 8,
        },
        outlined: {
          border: `1px solid ${n.borderSubtle}`,
        },
        elevation1: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        },
        elevation2: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
        elevation3: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 40,
        },
        indicator: {
          backgroundColor: FILL_ACCENT,
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          padding: '8px 16px',
          fontWeight: 600,
          fontSize: '0.8125rem',
          color: AQUA_TEXT,
          textTransform: 'none',
          borderRadius: '8px 8px 0 0',
          border: '1px solid transparent',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.08)',
          },
          '&.Mui-selected': {
            color: '#ffffff',
            backgroundColor: FILL_ACCENT,
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.03)',
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.8125rem',
          fontWeight: 500,
        },
        filled: {
          backgroundColor: FILL_ACCENT_TINT,
          color: TEAL_ACCENT,
          '&:hover': {
            backgroundColor: FILL_ACCENT_TINT_HOVER,
          },
        },
        outlined: {
          borderColor: n.border,
          '&:hover': {
            borderColor: AQUA_TEXT,
            backgroundColor: 'rgba(0,171,187,0.04)',
          },
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: {
          // Deliberately not mode-aware, unlike everything else in this
          // file - a thin track/small thumb, not a filled panel, so aqua
          // reads fine on a dark surface the same way it does on light.
          color: '#00ABBB',
          height: 6,
        },
        thumb: {
          width: 16,
          height: 16,
          backgroundColor: n.bgPaper,
          border: '2px solid #00ABBB',
          boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.16)',
          },
          '&:focus, &.Mui-active': {
            boxShadow: '0 0 0 8px rgba(0,171,187,0.16)',
          },
        },
        track: {
          height: 6,
          borderRadius: 3,
          background: 'linear-gradient(90deg, rgba(0,171,187,0.9), rgba(95,204,220,0.9))',
        },
        rail: {
          height: 6,
          borderRadius: 3,
          backgroundColor: n.surfaceAlt,
        },
        valueLabel: {
          backgroundColor: n.bgPaper,
          color: n.textPrimary,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          padding: '6px 8px',
          fontSize: '0.75rem',
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': {
              borderColor: n.border,
            },
            '&:hover fieldset': {
              borderColor: AQUA_TEXT,
            },
            '&.Mui-focused fieldset': {
              borderColor: AQUA_TEXT,
              borderWidth: 2,
            },
          },
        },
      },
    },

    // MuiPickersOutlinedInput lives in @mui/x-date-pickers, which this app has
    // no use for. Removed rather than kept as a dependency for one override.

    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          color: n.textPrimary,
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: n.border,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: AQUA_TEXT,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: AQUA_TEXT,
            borderWidth: 2,
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          padding: '6px 10px',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: TEAL_ACCENT,
          textTransform: 'none',
          backgroundColor: 'transparent',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.12)',
          },
          '&.Mui-selected': {
            backgroundColor: FILL_ACCENT,
            color: '#ffffff',
            '&:hover': {
              backgroundColor: TEAL_ACCENT,
            },
          },
        },
      },
    },

    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          backgroundColor: n.railBg,
          padding: 4,
          borderRadius: 8,
          border: `1px solid ${n.railBorder}`,
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: n.divider,
        },
      },
    },

    MuiListItem: {
      styleOverrides: {
        root: {
          paddingTop: 6,
          paddingBottom: 6,
          borderBottom: `1px dashed ${n.borderSubtle}`,
          fontSize: '0.8125rem',
          minHeight: 28,
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.04)',
          },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: n.tooltipBg,
          color: n.textPrimary,
          padding: '8px 10px',
          borderRadius: 8,
          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          fontSize: '0.75rem',
          border: `1px solid ${n.borderSubtle}`,
        },
        arrow: {
          color: n.tooltipBg,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          padding: 8,
          boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.25rem',
          fontWeight: 700,
          color: AQUA_TEXT,
          paddingBottom: 8,
          borderBottom: `1px solid ${n.borderSubtle}`,
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: n.bgPaper,
          color: n.textPrimary,
          boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: n.bgPaper,
          boxShadow: '-6px 0 28px rgba(9,20,26,0.06)',
          padding: '14px 16px 20px 16px',
        },
      },
    },

    MuiBadge: {
      styleOverrides: {
        badge: {
          backgroundColor: '#00ABBB',
          color: '#ffffff',
          fontWeight: 600,
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 10,
          borderRadius: 6,
          backgroundColor: n.surfaceAlt,
        },
        bar: {
          borderRadius: 6,
          background: 'linear-gradient(90deg, rgba(0,171,187,0.9), rgba(95,204,220,0.9))',
        },
      },
    },

    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: AQUA_TEXT,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        standardInfo: {
          backgroundColor: 'rgba(0,171,187,0.12)',
          color: TEAL_ACCENT,
        },
        standardSuccess: {
          backgroundColor: 'rgba(226, 250, 236, 0.7)',
          color: '#1e8449',
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
        },
        switchBase: {
          padding: 1,
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
              backgroundColor: AQUA_TEXT,
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 24,
          height: 24,
          boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
        },
        track: {
          borderRadius: 13,
          backgroundColor: n.border,
          opacity: 1,
        },
      },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: n.border,
          '&.Mui-checked': {
            color: AQUA_TEXT,
          },
        },
      },
    },

    MuiRadio: {
      styleOverrides: {
        root: {
          color: n.border,
          '&.Mui-checked': {
            color: AQUA_TEXT,
          },
        },
      },
    },
  },

  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },

  spacing: 8,

  zIndex: {
    mobileStepper: 1000,
    speedDial: 1050,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 2000,
  },

  transitions: {
    duration: {
      shortest: 150,
      shorter: 180,
      short: 200,
      standard: 250,
      complex: 300,
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },
  });
}

/** Static light-mode theme - kept as the default export for anything that doesn't need to react to mode (none of the app's own code should import this directly; use `useTheme()` inside components instead, which resolves to whichever theme ThemedApp currently has mounted). */
const theme: Theme = getTheme('light');

export interface CustomMixins {
  tile: CSSObject;
  tileTitle: CSSObject;
  segmentedControl: CSSObject;
  focusRing: CSSObject;
  gradientBackground: CSSObject;
  pulseAnimation: CSSObject;
  spinAnimation: CSSObject;
}

export const customMixins: CustomMixins = {
  tile: {
    background: '#ffffff',
    borderRadius: 8,
    padding: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #f0f0f0',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
    },
  },

  tileTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#00ABBB',
    position: 'relative',
    paddingBottom: 8,
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 1,
      background: 'linear-gradient(90deg, rgba(0,171,187,0.12), rgba(0,171,187,0.04))',
      pointerEvents: 'none',
      borderRadius: 1,
    },
  },

  segmentedControl: {
    display: 'inline-flex',
    background: '#f6f8f9',
    padding: 4,
    borderRadius: 8,
    border: '1px solid #e9f1f2',
  },

  focusRing: {
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(0,171,187,0.12)',
    borderRadius: 6,
  },

  gradientBackground: {
    background: 'linear-gradient(180deg, #F4F1E9, rgba(0,171,187,0.06))',
  },

  pulseAnimation: {
    '@keyframes pulse': {
      '0%': {
        transform: 'scale(1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
      '50%': {
        transform: 'scale(1.06)',
        boxShadow: '0 6px 18px rgba(59,56,56,0.12)',
      },
      '100%': {
        transform: 'scale(1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    },
  },

  spinAnimation: {
    '@keyframes spin': {
      to: { transform: 'rotate(360deg)' },
    },
  },
};

export default theme;
