import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getTheme } from '../theme';

const ThemeModeContext = createContext({
  mode: 'dark',
  toggleColorMode: () => {},
  setMode: () => {},
  isDark: true,
  isLight: false,
});

export const useColorMode = () => useContext(ThemeModeContext);

export function ThemeModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      const saved = localStorage.getItem('cyber_theme_mode');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {
      // ignore localStorage errors
    }
    return 'dark';
  });

  const setMode = (newMode) => {
    if (newMode === 'light' || newMode === 'dark') {
      setModeState(newMode);
    }
  };

  const toggleColorMode = () => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    try {
      localStorage.setItem('cyber_theme_mode', mode);
    } catch (e) {
      // ignore
    }
    document.documentElement.setAttribute('data-theme', mode);
    if (document.body) {
      document.body.setAttribute('data-theme', mode);
    }
  }, [mode]);

  const theme = useMemo(() => getTheme(mode), [mode]);

  const contextValue = useMemo(() => ({
    mode,
    toggleColorMode,
    setMode,
    isDark: mode === 'dark',
    isLight: mode === 'light',
  }), [mode]);

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export default ThemeModeProvider;
