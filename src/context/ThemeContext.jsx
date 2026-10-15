import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'cse-portal-theme-preference';
const ThemeContext = createContext(null);

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ['light', 'dark', 'system'].includes(value) ? value : 'system';
  } catch (_) {
    return 'system';
  }
}

function resolveTheme(preference) {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(getStoredPreference()));

  useEffect(() => {
    const applyTheme = () => {
      const nextTheme = resolveTheme(preference);
      setResolvedTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    applyTheme();
    try { localStorage.setItem(STORAGE_KEY, preference); } catch (_) { /* Browser storage is optional. */ }

    if (preference !== 'system' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme();
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, [preference]);

  const value = useMemo(() => ({
    preference,
    resolvedTheme,
    setPreference: nextPreference => setPreference(['light', 'dark', 'system'].includes(nextPreference) ? nextPreference : 'system'),
    toggleTheme: () => setPreference(current => resolvedTheme === 'dark' ? 'light' : 'dark')
  }), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider.');
  return context;
}

