import { createElement, useEffect, useMemo, useState } from 'react'
import {
  CssBaseline,
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from '@mui/material'
import ThemeContext from './ThemeContextValue'

export default function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const storedMode = window.localStorage.getItem('themeMode')
    return storedMode === 'light' || storedMode === 'dark' ? storedMode : 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    return () => {
      root.classList.remove('dark')
      root.style.colorScheme = ''
    }
  }, [mode])

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#4f46e5', dark: '#4338ca', contrastText: '#ffffff' },
      success: { main: '#22c55e', dark: '#16a34a', contrastText: '#052e16' },
      background: mode === 'dark'
        ? { default: '#0B1329', paper: '#0f172a' }
        : { default: '#f8fafc', paper: '#ffffff' },
      text: mode === 'dark'
        ? { primary: '#f8fafc', secondary: '#cbd5e1' }
        : { primary: '#0f172a', secondary: '#475569' },
    },
    typography: {
      fontFamily: '"Inter", sans-serif',
      fontSize: 14,
      h1: { fontSize: '2.75rem', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.04em' },
      h2: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.035em' },
      h3: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.03em' },
      h4: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.025em' },
      h5: { fontSize: '1.375rem', fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.02em' },
      h6: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4, letterSpacing: '-0.01em' },
      subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
      subtitle2: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.5 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      button: { fontSize: '0.875rem', textTransform: 'none', fontWeight: 600, lineHeight: 1.4 },
      caption: { fontSize: '0.8125rem', lineHeight: 1.45 },
      overline: { fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.1em' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            transition: 'all 300ms ease-in-out',
            '&:active': { transform: 'scale(0.96)' },
          },
        },
      },
    },
  }), [mode])

  const value = useMemo(() => ({
    mode,
    toggleMode: () => {
      const newMode = mode === 'light' ? 'dark' : 'light'
      window.localStorage.setItem('themeMode', newMode)
      setMode(newMode)
    },
  }), [mode])

  return createElement(
    MuiThemeProvider,
    { theme },
    createElement(CssBaseline),
    createElement(ThemeContext.Provider, { value }, children),
  )
}
