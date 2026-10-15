import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle({ compact = false }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const nextLabel = resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return <button
    type="button"
    className={`theme-toggle${compact ? ' theme-toggle-compact' : ''}`}
    onClick={toggleTheme}
    aria-label={nextLabel}
    title={nextLabel}
  >
    {resolvedTheme === 'dark' ? <Sun size={compact ? 17 : 18} /> : <Moon size={compact ? 17 : 18} />}
    {!compact && <span>{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
  </button>;
}

export default ThemeToggle;
