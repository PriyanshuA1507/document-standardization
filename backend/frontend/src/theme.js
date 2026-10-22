import { createTheme } from '@mui/material/styles';

export const getTheme = (mode = 'dark') => {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode: isLight ? 'light' : 'dark',
      primary: isLight
        ? {
            main: '#0284C7',
            light: '#38BDF8',
            dark: '#0369A1',
            contrastText: '#FFFFFF',
          }
        : {
            main: '#00D4FF',
            light: '#33DDFF',
            dark: '#0099CC',
            contrastText: '#070B12',
          },
      secondary: isLight
        ? {
            main: '#059669',
            light: '#10B981',
            dark: '#047857',
            contrastText: '#FFFFFF',
          }
        : {
            main: '#00E676',
            light: '#33EB91',
            dark: '#00B85C',
            contrastText: '#070B12',
          },
      error: isLight
        ? {
            main: '#DC2626',
            light: '#EF4444',
            dark: '#B91C1C',
          }
        : {
            main: '#FF1744',
            light: '#FF4569',
            dark: '#CC1236',
          },
      warning: isLight
        ? {
            main: '#D97706',
            light: '#F59E0B',
            dark: '#B45309',
          }
        : {
            main: '#FF9100',
            light: '#FFA733',
            dark: '#CC7400',
          },
      info: isLight
        ? {
            main: '#6366F1',
            light: '#818CF8',
            dark: '#4F46E5',
          }
        : {
            main: '#7C4DFF',
            light: '#9670FF',
            dark: '#633ECC',
          },
      success: isLight
        ? {
            main: '#059669',
            light: '#10B981',
            dark: '#047857',
          }
        : {
            main: '#00E676',
            light: '#33EB91',
            dark: '#00B85C',
          },
      background: isLight
        ? {
            default: '#F8FAFC',
            paper: '#FFFFFF',
          }
        : {
            default: '#070B12',
            paper: '#0D1527',
          },
      text: isLight
        ? {
            primary: '#0F172A',
            secondary: '#475569',
          }
        : {
            primary: '#F1F5F9',
            secondary: '#94A3B8',
          },
      divider: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.07)',
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
          body: isLight
            ? {
                backgroundColor: '#F8FAFC',
                backgroundImage:
                  'radial-gradient(circle at 50% 0%, rgba(2, 132, 199, 0.04) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)',
                backgroundAttachment: 'fixed',
                color: '#0F172A',
              }
            : {
                backgroundColor: '#070B12',
                backgroundImage:
                  'radial-gradient(circle at 50% 0%, rgba(0, 212, 255, 0.06) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(124, 77, 255, 0.03) 0%, transparent 50%)',
                backgroundAttachment: 'fixed',
                color: '#F1F5F9',
              },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: isLight
            ? {
                backgroundImage: 'none',
                backgroundColor: '#FFFFFF',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
                borderRadius: 14,
              }
            : {
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
          root: isLight
            ? {
                backgroundImage: 'none',
                backgroundColor: '#FFFFFF',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
                borderRadius: 14,
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease',
                '&:hover': {
                  border: '1px solid rgba(2, 132, 199, 0.4)',
                  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.1), 0 0 16px rgba(2, 132, 199, 0.08)',
                  transform: 'translateY(-2px)',
                },
              }
            : {
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
          containedPrimary: isLight
            ? {
                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                color: '#FFFFFF',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0369A1 0%, #075985 100%)',
                  boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)',
                  transform: 'translateY(-1px)',
                },
              }
            : {
                background: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
                color: '#070B12',
                boxShadow: '0 4px 16px rgba(0, 212, 255, 0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #33DDFF 0%, #00B8E6 100%)',
                  boxShadow: '0 6px 22px rgba(0, 212, 255, 0.45)',
                  transform: 'translateY(-1px)',
                },
              },
          outlinedPrimary: isLight
            ? {
                borderColor: 'rgba(2, 132, 199, 0.4)',
                color: '#0284C7',
                '&:hover': {
                  backgroundColor: 'rgba(2, 132, 199, 0.06)',
                  borderColor: '#0284C7',
                  boxShadow: '0 0 12px rgba(2, 132, 199, 0.15)',
                },
              }
            : {
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
              backgroundColor: isLight ? '#F8FAFC' : 'rgba(7, 11, 18, 0.4)',
              transition: 'all 0.2s ease',
              '& fieldset': {
                borderColor: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.08)',
              },
              '&:hover fieldset': {
                borderColor: isLight ? 'rgba(2, 132, 199, 0.5)' : 'rgba(0, 212, 255, 0.3)',
              },
              '&.Mui-focused fieldset': {
                borderColor: isLight ? '#0284C7' : '#00D4FF',
                boxShadow: isLight
                  ? '0 0 10px rgba(2, 132, 199, 0.15)'
                  : '0 0 12px rgba(0, 212, 255, 0.15)',
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
              backgroundColor: isLight
                ? 'rgba(2, 132, 199, 0.04) !important'
                : 'rgba(0, 212, 255, 0.04) !important',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.05)',
            padding: '12px 16px',
            color: isLight ? '#0F172A' : '#F1F5F9',
          },
          head: {
            fontWeight: 600,
            color: isLight ? '#475569' : '#94A3B8',
            backgroundColor: isLight ? '#F1F5F9' : 'rgba(7, 11, 18, 0.65)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '0.725rem',
            borderBottom: isLight
              ? '1px solid rgba(15, 23, 42, 0.1)'
              : '1px solid rgba(255, 255, 255, 0.08)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: isLight
            ? {
                backgroundColor: '#FFFFFF',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(15, 23, 42, 0.08)',
                boxShadow: '2px 0 12px rgba(15, 23, 42, 0.03)',
              }
            : {
                backgroundColor: 'rgba(8, 14, 26, 0.96)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: isLight
            ? {
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              }
            : {
                backgroundColor: 'rgba(8, 14, 26, 0.88)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: 'none',
              },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: isLight
            ? {
                backgroundColor: '#0F172A',
                color: '#F8FAFC',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
                padding: '6px 12px',
              }
            : {
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
};

const defaultTheme = getTheme('dark');
export default defaultTheme;
