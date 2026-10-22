import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00D4FF',
      light: '#33DDFF',
      dark: '#0099CC',
      contrastText: '#070B12',
    },
    secondary: {
      main: '#00E676',
      light: '#33EB91',
      dark: '#00B85C',
      contrastText: '#070B12',
    },
    error: {
      main: '#FF1744',
      light: '#FF4569',
      dark: '#CC1236',
    },
    warning: {
      main: '#FF9100',
      light: '#FFA733',
      dark: '#CC7400',
    },
    info: {
      main: '#7C4DFF',
      light: '#9670FF',
      dark: '#633ECC',
    },
    success: {
      main: '#00E676',
      light: '#33EB91',
      dark: '#00B85C',
    },
    background: {
      default: '#070B12',
      paper: '#0D1527',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: 'rgba(255, 255, 255, 0.07)',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500, letterSpacing: '0.01em' },
    subtitle2: { fontWeight: 500, fontSize: '0.8rem' },
    body1: { fontSize: '0.9rem', lineHeight: 1.55 },
    body2: { fontSize: '0.825rem', lineHeight: 1.5 },
    button: { fontWeight: 600, letterSpacing: '0.02em', textTransform: 'none' },
    caption: { fontSize: '0.725rem', letterSpacing: '0.03em' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#070B12',
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(0, 212, 255, 0.06) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(124, 77, 255, 0.03) 0%, transparent 50%)',
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(13, 21, 39, 0.72)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
          borderRadius: 14,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(13, 21, 39, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: '0 8px 28px 0 rgba(0, 0, 0, 0.4)',
          borderRadius: 14,
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease',
          '&:hover': {
            border: '1px solid rgba(0, 212, 255, 0.28)',
            boxShadow: '0 10px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.08)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 20px',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
          color: '#070B12',
          boxShadow: '0 4px 16px rgba(0, 212, 255, 0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #33DDFF 0%, #00B8E6 100%)',
            boxShadow: '0 6px 22px rgba(0, 212, 255, 0.45)',
            transform: 'translateY(-1px)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(0, 212, 255, 0.35)',
          color: '#00D4FF',
          '&:hover': {
            backgroundColor: 'rgba(0, 212, 255, 0.08)',
            borderColor: '#00D4FF',
            boxShadow: '0 0 16px rgba(0, 212, 255, 0.2)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: 'rgba(7, 11, 18, 0.4)',
            transition: 'all 0.2s ease',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.08)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 212, 255, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#00D4FF',
              boxShadow: '0 0 12px rgba(0, 212, 255, 0.15)',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
          fontSize: '0.75rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.18s ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 212, 255, 0.04) !important',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.05)',
          padding: '12px 16px',
        },
        head: {
          fontWeight: 600,
          color: '#94A3B8',
          backgroundColor: 'rgba(7, 11, 18, 0.65)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontSize: '0.725rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(8, 14, 26, 0.96)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(8, 14, 26, 0.88)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(11, 19, 43, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          color: '#F1F5F9',
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          padding: '6px 12px',
        },
      },
    },
  },
});

export default theme;
