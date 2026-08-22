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
import type { Theme } from '@mui/material/styles';
import type { CSSObject } from '@emotion/react';

// GSC Brand Colors:
// Primary:   Aqua #00ABBB | Peach #F6AB84 | Citrus #FBB114
// Secondary: Teal #008194 | Burnt Orange #EF864C | Off White #F4F1E9 | Deep Gray #3B3838 | Bright Yellow #FFF34A (gradients only)

const theme: Theme = createTheme({
  palette: {
    primary: {
      main: '#00ABBB',        // GSC Aqua
      light: '#5FCCD8',
      dark: '#008194',        // GSC Teal
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
      dark: '#008194',        // GSC Teal
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
      primary: '#3B3838',     // GSC Deep Gray
      secondary: '#6B7280',
      disabled: '#9CA3AF',
    },
    background: {
      default: '#F4F1E9',     // GSC Off White
      paper: '#FFFFFF',
    },
    divider: '#E5E7EB',
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
      color: '#3B3838',
    },
    h2: {
      fontSize: '1.375rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: '#3B3838',
    },
    h3: {
      fontSize: '1rem',
      fontWeight: 500,
      color: '#3B3838',
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#00ABBB',
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: '#3B3838',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      color: '#00ABBB',
    },
    h7: {
      fontSize: '1rem',
      fontWeight: 600,
      color: '#3B3838',
    },
    subtitle1: {
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#3B3838',
    },
    subtitle2: {
      fontSize: '0.8125rem',
      fontWeight: 500,
      color: '#6B7280',
    },
    body1: {
      fontSize: '0.875rem',
      color: '#3B3838',
    },
    body2: {
      fontSize: '0.8125rem',
      color: '#6B7280',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.6875rem',
      color: '#6B7280',
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#6B7280',
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
          backgroundColor: '#00ABBB',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#008194',
          },
        },
        outlined: {
          border: '1px solid #e6e6e6',
          '&:hover': {
            border: '1px solid #00ABBB',
            backgroundColor: 'rgba(0,171,187,0.04)',
          },
        },
        text: {
          color: '#00ABBB',
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.08)',
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
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
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderRadius: 8,
        },
        outlined: {
          border: '1px solid #f0f0f0',
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
          backgroundColor: '#00ABBB',
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
          color: '#00ABBB',
          textTransform: 'none',
          borderRadius: '8px 8px 0 0',
          border: '1px solid transparent',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.08)',
          },
          '&.Mui-selected': {
            color: '#ffffff',
            backgroundColor: '#00ABBB',
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
          backgroundColor: 'rgba(0,171,187,0.12)',
          color: '#008194',
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.2)',
          },
        },
        outlined: {
          borderColor: '#e6e6e6',
          '&:hover': {
            borderColor: '#00ABBB',
            backgroundColor: 'rgba(0,171,187,0.04)',
          },
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: {
          color: '#00ABBB',
          height: 6,
        },
        thumb: {
          width: 16,
          height: 16,
          backgroundColor: '#ffffff',
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
          backgroundColor: '#f3f6f7',
        },
        valueLabel: {
          backgroundColor: '#ffffff',
          color: '#3B3838',
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
              borderColor: '#e6e6e6',
            },
            '&:hover fieldset': {
              borderColor: '#00ABBB',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#00ABBB',
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
          color: '#3B3838',
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e6e6e6',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00ABBB',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00ABBB',
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
          color: '#008194',
          textTransform: 'none',
          backgroundColor: 'transparent',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(0,171,187,0.12)',
          },
          '&.Mui-selected': {
            backgroundColor: '#00ABBB',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#008194',
            },
          },
        },
      },
    },

    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          backgroundColor: '#f6f8f9',
          padding: 4,
          borderRadius: 8,
          border: '1px solid #e9f1f2',
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(0, 0, 0, 0.06)',
        },
      },
    },

    MuiListItem: {
      styleOverrides: {
        root: {
          paddingTop: 6,
          paddingBottom: 6,
          borderBottom: '1px dashed #f2f2f2',
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
          backgroundColor: '#ffffff',
          color: '#3B3838',
          padding: '8px 10px',
          borderRadius: 8,
          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          fontSize: '0.75rem',
          border: '1px solid #f0f0f0',
        },
        arrow: {
          color: '#ffffff',
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
          color: '#00ABBB',
          paddingBottom: 8,
          borderBottom: '1px solid #eeeeee',
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#3B3838',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
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
          backgroundColor: '#f3f6f7',
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
          color: '#00ABBB',
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
          color: '#008194',
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
              backgroundColor: '#00ABBB',
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
          backgroundColor: '#e6e6e6',
          opacity: 1,
        },
      },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#e6e6e6',
          '&.Mui-checked': {
            color: '#00ABBB',
          },
        },
      },
    },

    MuiRadio: {
      styleOverrides: {
        root: {
          color: '#e6e6e6',
          '&.Mui-checked': {
            color: '#00ABBB',
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
